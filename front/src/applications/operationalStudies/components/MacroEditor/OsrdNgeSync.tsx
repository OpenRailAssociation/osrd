import { isNil, sortBy, uniqBy } from 'lodash';
import { Layout } from 'webcola';
import type { Node as ColaNode } from 'webcola';

import type {
  MacroNodeResponse,
  ScenarioResponse,
  SearchPayload,
  SearchQuery,
  SearchResultItemOperationalPoint,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

import handleOperation, {
  DEFAULT_TRAINRUN_FREQUENCIES,
  DEFAULT_TRAINRUN_FREQUENCY,
} from './ngeToOsrd';
import { addDurationToDate } from './utils';
import {
  type PortDto,
  type TimeLockDto,
  type TrainrunSectionDto,
  type TrainrunCategory,
  type TrainrunTimeCategory,
  type NetzgrafikDto,
  type LabelGroupDto,
  PortAlignment,
  type NGEEvent,
  type NodeDto,
} from '../NGE/types';

const TRAINRUN_CATEGORY_HALTEZEITEN = {
  HaltezeitIPV: { haltezeit: 0, no_halt: false },
  HaltezeitA: { haltezeit: 0, no_halt: false },
  HaltezeitB: { haltezeit: 0, no_halt: false },
  HaltezeitC: { haltezeit: 0, no_halt: false },
  HaltezeitD: { haltezeit: 0, no_halt: false },
  HaltezeitUncategorized: { haltezeit: 0, no_halt: false },
};

const DEFAULT_LABEL_GROUP: LabelGroupDto = {
  id: 1,
  name: 'Default',
  labelRef: 'Trainrun',
};

const DEFAULT_TRAINRUN_CATEGORY: TrainrunCategory = {
  id: 1, // In NGE, Trainrun.DEFAULT_TRAINRUN_CATEGORY
  order: 0,
  name: 'Default',
  shortName: '', // TODO: find a better way to hide this in the graph
  fachCategory: 'HaltezeitUncategorized',
  colorRef: 'EC',
  minimalTurnaroundTime: 0,
  nodeHeadwayStop: 0,
  nodeHeadwayNonStop: 0,
  sectionHeadway: 0,
};

const DEFAULT_TRAINRUN_TIME_CATEGORY: TrainrunTimeCategory = {
  id: 0, // In NGE, Trainrun.DEFAULT_TRAINRUN_TIME_CATEGORY
  order: 0,
  name: 'Default',
  shortName: '7/24',
  dayTimeInterval: [],
  weekday: [1, 2, 3, 4, 5, 6, 7],
  linePatternRef: '7/24',
};

const DEFAULT_DTO: NetzgrafikDto = {
  resources: [],
  nodes: [],
  trainruns: [],
  trainrunSections: [],
  metadata: {
    netzgrafikColors: [],
    trainrunCategories: [DEFAULT_TRAINRUN_CATEGORY],
    trainrunFrequencies: [...DEFAULT_TRAINRUN_FREQUENCIES],
    trainrunTimeCategories: [DEFAULT_TRAINRUN_TIME_CATEGORY],
  },
  freeFloatingTexts: [],
  labels: [],
  labelGroups: [],
  filterData: {
    filterSettings: [],
  },
};

const DEFAULT_TIME_LOCK: TimeLockDto = {
  time: null,
  consecutiveTime: null,
  lock: false,
  warning: null,
  timeFormatter: null,
};

type NodeIndex = { node: MacroNodeResponse; saved: boolean };
export default class OsrdNgeSync {
  /**
   * Storing nodes by path item key
   * It's the main storage for node.
   * The saved attribut is to know if the data comes from the API
   * If the value is a string, it's a key redirection
   */
  private nodesByPathKey: Record<string, NodeIndex | string>;

  /**
   * We keep a dictionnary of id/key to be able to find a node by its id
   */
  private nodesIdToKey: Record<number, string>;

  /**
   * Storing labels
   */
  private labels: Set<string>;

  /**
   * NGE resource
   */
  private ngeResource = { id: 1, capacity: 0 };

  /**
   * Default constructor
   */
  constructor(
    private dispatch: AppDispatch,
    private readonly scenario: ScenarioResponse,
    private trainSchedules: TrainScheduleResult[]
  ) {
    // Empty
    this.labels = new Set<string>([]);
    this.nodesIdToKey = {};
    this.nodesByPathKey = {};
    this.ngeResource = { id: 1, capacity: trainSchedules.length };
  }

  /**
   * Load & index the data of the train schedule for the given scenario
   */
  async loadAndIndex(): Promise<void> {
    // Load path items
    this.trainSchedules
      .map((schedule) => schedule.path)
      .flat()
      .forEach((pathItem, index) => {
        const key = OsrdNgeSync.getPathKey(pathItem);
        if (!this.getNodeByKey(key)) {
          const macroNode = {
            // negative is just to be sure that the id is not already taken
            // by a node saved in the DB
            id: index * -1,
            path_item_key: key,
            connection_time: 0,
            labels: [],
            position_x: 0,
            position_y: 0,
          };
          this.indexNode(macroNode);
        }
      });

    // Enhance nodes by calling the search API
    const searchResults = await this.executeSearch();
    searchResults.forEach((searchResult) => {
      const macroNode = {
        fullName: searchResult.name,
        trigram: searchResult.trigram + (searchResult.ch ? `/${searchResult.ch}` : ''),
        positionX: searchResult.geographic.coordinates[0],
        positionY: searchResult.geographic.coordinates[1],
      };
      OsrdNgeSync.getPathKeys(searchResult).forEach((opId) => {
        this.updateNodeDataByKey(opId, macroNode);
      });
    });

    // Load saved node and update the indexed nodes
    const savedNodes = await this.apiGetSavedNodes();
    savedNodes.forEach((n) => {
      this.updateNodeDataByKey(n.path_item_key, n, true);
    });

    // Dedup nodes
    this.dedupNodes();

    // Index trainschedule labels
    this.trainSchedules.forEach((ts) => {
      ts.labels?.forEach((l) => {
        this.labels.add(l);
      });
    });

    // Now that we have all node, we apply a layout
    this.applyLayout();
  }

  /**
   * Return a comptible object for NGE
   */
  public getNgeDto(): NetzgrafikDto {
    return {
      ...DEFAULT_DTO,
      labels: Array.from(this.labels).map((l, i) => ({
        id: i,
        label: l,
        labelGroupId: DEFAULT_LABEL_GROUP.id,
        labelRef: 'Trainrun',
      })),
      labelGroups: [DEFAULT_LABEL_GROUP],
      resources: [this.ngeResource],
      metadata: {
        netzgrafikColors: [],
        trainrunCategories: [DEFAULT_TRAINRUN_CATEGORY],
        trainrunFrequencies: [DEFAULT_TRAINRUN_FREQUENCY],
        trainrunTimeCategories: [DEFAULT_TRAINRUN_TIME_CATEGORY],
      },
      trainruns: this.getNgeTrainruns(),
      ...this.getNgeTrainrunSectionsWithNodes(),
    };
  }

  public getNgeListener(params: {
    addUpsertedTrainSchedules: (upsertedTrainSchedules: TrainScheduleResult[]) => void;
    addDeletedTrainIds: (trainIds: number[]) => void;
  }) {
    return (event: NGEEvent, netzgrafikDto: NetzgrafikDto) => {
      const { addUpsertedTrainSchedules, addDeletedTrainIds } = params;
      handleOperation({
        event,
        dispatch: this.dispatch,
        infraId: this.scenario.infra_id,
        timeTableId: this.scenario.timetable_id,
        netzgrafikDto,
        addUpsertedTrainSchedules,
        addDeletedTrainIds,
        handleNodeOperation: (ngeEvent) => {
          this.handleNgeNodeOperation(ngeEvent.type, ngeEvent.node, netzgrafikDto);
        },
      });
    };
  }

  public async handleNgeNodeOperation(
    type: NGEEvent['type'],
    node: NodeDto,
    netzgrafikDto: NetzgrafikDto
  ) {
    const indexNode = this.getNodeById(node.id);
    switch (type) {
      case 'create':
      case 'update': {
        if (indexNode) {
          if (indexNode.saved) {
            // Update the key if trigram has changed and key is based on it
            let nodeKey = indexNode.node.path_item_key;
            if (
              nodeKey.startsWith('trigram:') &&
              indexNode.node.trigram !== node.betriebspunktName
            ) {
              nodeKey = `trigram:${node.betriebspunktName}`;
            }
            await this.apiUpdateNode({
              ...indexNode.node,
              ...OsrdNgeSync.castNgeNode(node, netzgrafikDto.labels),
              id: indexNode.node.id,
              path_item_key: nodeKey,
            });
          } else {
            const newNode = {
              ...indexNode.node,
              ...OsrdNgeSync.castNgeNode(node, netzgrafikDto.labels),
            };
            // Create the node
            await this.apiCreateNode(newNode);
            // keep track of the ID given by NGE
            this.nodesIdToKey[node.id] = newNode.path_item_key;
          }
        } else {
          // It's an unknown node, we need to create it in the db
          // We assume that `betriebspunktName` is a trigram
          const key = `trigram:${node.betriebspunktName}`;
          // Create the node
          await this.apiCreateNode({
            ...OsrdNgeSync.castNgeNode(node, netzgrafikDto.labels),
            path_item_key: key,
          });
          // keep track of the ID given by NGE
          this.nodesIdToKey[node.id] = key;
        }
        break;
      }
      case 'delete': {
        if (indexNode) await this.apiDeleteNode(indexNode.node);
        break;
      }
      default:
        break;
    }
  }

  /**
   * Check if we have duplicates
   * Ex: one key is trigram and an other is uic (with the same trigram), we should keep trigram
   * What we do :
   *  - Make a list of key,trigram
   *  - aggregate on trigram to build a list of key
   *  - filter if the array is of size 1 (ie, no dedup todo)
   *  - sort the keys by priority
   *  - add redirection in the nodesByPathKey
   */
  private dedupNodes(): void {
    const trigramAggreg = Object.entries(this.nodesByPathKey)
      .filter(([_, value]) => typeof value !== 'string' && value.node.trigram)
      .map(([key, value]) => ({ key, trigram: (value as NodeIndex).node.trigram }))
      .reduce(
        (acc, curr) => {
          acc[`${curr.trigram}`] = [...(acc[`${curr.trigram}`] || []), curr.key];
          return acc;
        },
        {} as Record<string, string[]>
      );

    for (const trig of Object.keys(trigramAggreg)) {
      if (trigramAggreg[trig].length < 2) {
        delete trigramAggreg[trig];
      }
      trigramAggreg[trig] = sortBy(trigramAggreg[trig], (key) => {
        if (key.startsWith('op_id:')) return 1;
        if (key.startsWith('trigram:')) return 2;
        if (key.startsWith('uic:')) return 3;
        // default
        return 4;
      });
    }

    Object.values(trigramAggreg).forEach((mergeList) => {
      const mainNodeKey = mergeList[0];
      mergeList.slice(1).forEach((key) => {
        this.nodesByPathKey[key] = mainNodeKey;
      });
    });
  }

  /**
   * Store and index the node.
   */
  private indexNode(node: MacroNodeResponse, saved = false) {
    // Remove in the id index, its previous value
    const currentValue = this.getNodeByKey(node.path_item_key);
    if (currentValue && typeof currentValue !== 'string') {
      const prevId = currentValue.node.id;
      delete this.nodesIdToKey[prevId];
    }

    // Index
    this.nodesByPathKey[node.path_item_key] = { node, saved };
    this.nodesIdToKey[node.id] = node.path_item_key;
    node.labels.forEach((l) => {
      if (l) this.labels.add(l);
    });
  }

  /**
   * Update node's data by it's key
   */
  private updateNodeDataByKey(
    key: string,
    data: Partial<NodeIndex['node']>,
    saved: undefined | boolean = undefined
  ) {
    const indexedNode = this.getNodeByKey(key);
    if (indexedNode) {
      this.indexNode(
        { ...indexedNode.node, ...data },
        saved === undefined ? indexedNode.saved : saved
      );
    }
  }

  /**
   * Delete a node by it's key
   */
  private deleteNodeByKey(key: string) {
    const indexedNode = this.getNodeByKey(key);
    if (indexedNode) {
      delete this.nodesIdToKey[indexedNode.node.id];
      delete this.nodesByPathKey[key];
    }
  }

  /**
   * Get a node by its key.
   */
  private getNodeByKey(key: string): NodeIndex | null {
    let result: NodeIndex | null = null;
    let currentKey: string | null = key;
    while (currentKey !== null) {
      const found: string | NodeIndex = this.nodesByPathKey[currentKey];
      if (typeof found === 'string') {
        currentKey = found;
      } else {
        currentKey = null;
        result = found;
      }
    }
    return result;
  }

  /**
   * Get a node by its id.
   */
  private getNodeById(id: number) {
    const key = this.nodesIdToKey[id];
    return this.getNodeByKey(key);
  }

  /**
   * Translate the train schedule in NGE "trainruns".
   */
  private getNgeTrainruns() {
    return this.trainSchedules.map((trainSchedule) => ({
      id: trainSchedule.id,
      name: trainSchedule.train_name,
      categoryId: DEFAULT_TRAINRUN_CATEGORY.id,
      frequencyId: DEFAULT_TRAINRUN_FREQUENCY.id,
      trainrunTimeCategoryId: DEFAULT_TRAINRUN_TIME_CATEGORY.id,
      labelIds: (trainSchedule.labels || []).map((l) =>
        Array.from(this.labels).findIndex((e) => e === l)
      ),
    }));
  }

  /**
   * Translate the train schedule in NGE "trainrunSection" & "nodes".
   * It is needed to return the nodes as well, because we add ports & transitions on them
   */
  private getNgeTrainrunSectionsWithNodes() {
    let portId = 1;
    const createPort = (trainrunSectionId: number) => {
      const port = {
        id: portId,
        trainrunSectionId,
        positionIndex: 0,
        positionAlignment: PortAlignment.Top,
      };
      portId += 1;
      return port;
    };

    let transitionId = 1;
    const createTransition = (port1Id: number, port2Id: number) => {
      const transition = {
        id: transitionId,
        port1Id,
        port2Id,
        isNonStopTransit: false,
      };
      transitionId += 1;
      return transition;
    };

    // Track nge nodes
    const ngeNodesByPathKey: Record<string, NetzgrafikDto['nodes'][0]> = {};
    let trainrunSectionId = 0;
    const trainrunSections: TrainrunSectionDto[] = this.trainSchedules
      .map((trainSchedule) => {
        // Figure out the primary node key for each path item
        const pathNodeKeys = trainSchedule.path.map((pathItem) => {
          const node = this.getNodeByKey(OsrdNgeSync.getPathKey(pathItem));
          return node!.node.path_item_key;
        });

        const startTime = new Date(trainSchedule.start_time);
        const createTimeLock = (time: Date): TimeLockDto => ({
          time: time.getMinutes(),
          // getTime() is in milliseconds, consecutiveTime is in minutes
          consecutiveTime: (time.getTime() - startTime.getTime()) / (60 * 1000),
          lock: false,
          warning: null,
          timeFormatter: null,
        });

        // OSRD describes the path in terms of nodes, NGE describes it in terms
        // of sections between nodes. Iterate over path items two-by-two to
        // convert them.
        let prevPort: PortDto | null = null;
        return pathNodeKeys.slice(0, -1).map((sourceNodeOpId, i) => {
          // Get the source node or created it
          if (!ngeNodesByPathKey[sourceNodeOpId]) {
            ngeNodesByPathKey[sourceNodeOpId] = this.castNodeToNge(
              this.getNodeByKey(sourceNodeOpId)!.node
            );
          }
          const sourceNode = ngeNodesByPathKey[sourceNodeOpId];

          // Get the target node or created it
          const targetNodeKey = pathNodeKeys[i + 1];
          if (!ngeNodesByPathKey[targetNodeKey]) {
            ngeNodesByPathKey[targetNodeKey] = this.castNodeToNge(
              this.getNodeByKey(targetNodeKey)!.node
            );
          }
          const targetNode = ngeNodesByPathKey[targetNodeKey];

          // Adding port
          const sourcePort = createPort(trainrunSectionId);
          sourceNode.ports.push(sourcePort);
          const targetPort = createPort(trainrunSectionId);
          targetNode.ports.push(targetPort);

          // Adding schedule
          const sourceScheduleEntry = trainSchedule.schedule!.find(
            (entry) => entry.at === trainSchedule.path[i].id
          );
          const targetScheduleEntry = trainSchedule.schedule!.find(
            (entry) => entry.at === trainSchedule.path[i + 1].id
          );

          // Create a transition between the previous section and the one we're creating
          if (prevPort) {
            const transition = createTransition(prevPort.id, sourcePort.id);
            transition.isNonStopTransit = !sourceScheduleEntry?.stop_for;
            sourceNode.transitions.push(transition);
          }
          prevPort = targetPort;

          let sourceDeparture = { ...DEFAULT_TIME_LOCK };
          if (i === 0) {
            sourceDeparture = createTimeLock(startTime);
          } else if (sourceScheduleEntry && sourceScheduleEntry.arrival) {
            sourceDeparture = createTimeLock(
              addDurationToDate(
                addDurationToDate(startTime, sourceScheduleEntry.arrival),
                sourceScheduleEntry.stop_for || 'P0D'
              )
            );
          }

          let targetArrival = { ...DEFAULT_TIME_LOCK };
          if (targetScheduleEntry && targetScheduleEntry.arrival) {
            targetArrival = createTimeLock(
              addDurationToDate(startTime, targetScheduleEntry.arrival)
            );
          }

          const travelTime = { ...DEFAULT_TIME_LOCK };
          if (targetArrival.consecutiveTime !== null && sourceDeparture.consecutiveTime !== null) {
            travelTime.time = targetArrival.consecutiveTime - sourceDeparture.consecutiveTime;
            travelTime.consecutiveTime = travelTime.time;
          }

          const trainrunSection = {
            id: trainrunSectionId,
            sourceNodeId: sourceNode.id,
            sourcePortId: sourcePort.id,
            targetNodeId: targetNode.id,
            targetPortId: targetPort.id,
            travelTime,
            sourceDeparture,
            sourceArrival: { ...DEFAULT_TIME_LOCK },
            targetDeparture: { ...DEFAULT_TIME_LOCK },
            targetArrival,
            numberOfStops: 0,
            trainrunId: trainSchedule.id,
            resourceId: this.ngeResource.id,
            path: {
              path: [],
              textPositions: [],
            },
            specificTrainrunSectionFrequencyId: 0,
            warnings: [],
          };

          trainrunSectionId += 1;
          return trainrunSection;
        });
      })
      .flat();

    return {
      trainrunSections,
      nodes: Object.values(ngeNodesByPathKey),
    };
  }

  /**
   * Execute the search payload and collect all result pages.
   */
  private async executeSearch(): Promise<SearchResultItemOperationalPoint[]> {
    const searchResults: SearchResultItemOperationalPoint[] = [];
    const searchPayload = this.buildOpQuery();
    if (searchPayload) {
      const pageSize = 100;
      let done = false;
      for (let page = 1; !done; page += 1) {
        const searchPromise = this.dispatch(
          osrdEditoastApi.endpoints.postSearch.initiate(
            {
              page,
              pageSize,
              searchPayload,
            },
            { track: false }
          )
        );
        const results = (await searchPromise.unwrap()) as SearchResultItemOperationalPoint[];
        searchResults.push(...results);
        done = results.length < pageSize;
      }
    }
    return searchResults;
  }

  /**
   * Build a search query to fetch all operational points from their UICs,
   * trigrams and IDs.
   */
  private buildOpQuery(): SearchPayload | null {
    const pathItems = this.trainSchedules.map((schedule) => schedule.path).flat();
    const pathItemQueries = [];
    const pathItemSet = new Set<string>();
    for (const item of pathItems) {
      let query: SearchQuery;
      if ('uic' in item) {
        query = ['=', ['uic'], item.uic];
        if (item.secondary_code) {
          query = ['and', query, ['=', ['ch'], item.secondary_code]];
        }
      } else if ('trigram' in item) {
        query = ['=', ['trigram'], item.trigram];
        if (item.secondary_code) {
          query = ['and', query, ['=', ['ch'], item.secondary_code]];
        }
      } else if ('operational_point' in item) {
        query = ['=', ['obj_id'], item.operational_point];
      } else {
        continue; // track offset, handled by creating an empty node
      }

      // Avoid including the same query twice in the search payload
      const key = JSON.stringify(query);
      if (pathItemSet.has(key)) {
        continue;
      }

      pathItemSet.add(key);
      pathItemQueries.push(query);
    }

    if (pathItemQueries.length === 0) {
      return null;
    }

    return {
      object: 'operationalpoint',
      query: ['and', ['=', ['infra_id'], this.scenario.infra_id], ['or', ...pathItemQueries]],
    };
  }

  /**
   * Cast a node into NGE format.
   */
  private castNodeToNge(node: NodeIndex['node']): NetzgrafikDto['nodes'][0] {
    const labelsList = Array.from(this.labels);
    return {
      id: node.id,
      betriebspunktName: node.trigram || '',
      fullName: node.full_name || '',
      positionX: node.position_x,
      positionY: node.position_y,
      ports: [],
      transitions: [],
      connections: [],
      resourceId: this.ngeResource.id,
      perronkanten: 10,
      connectionTime: node.connection_time,
      trainrunCategoryHaltezeiten: TRAINRUN_CATEGORY_HALTEZEITEN,
      symmetryAxis: 0,
      warnings: [],
      labelIds: (node.labels || [])?.map((l) => labelsList.findIndex((e) => e === l)),
    };
  }

  /**
   * Create a graph structure from the time schedule.
   * /!\ on edges, the source & target is the position in the node array, not the id of the node.
   */
  private toGraph(): {
    nodes: { fixed: number; x: number; y: number; key: string }[];
    edges: { source: number; target: number; weight: number }[];
  } {
    const nodes = uniqBy(
      this.trainSchedules.map((ts) => ts.path).flat(),
      OsrdNgeSync.getPathKey
    ).map((pathItem) => {
      const key = OsrdNgeSync.getPathKey(pathItem);
      const nodeIndexed = this.getNodeByKey(key);
      const fixed = nodeIndexed!.saved ? 1 : 0;
      return {
        key,
        x: nodeIndexed!.node.position_x,
        y: nodeIndexed!.node.position_y,
        height: 100,
        width: 50,
        fixed,
      };
    });

    const nodeIndexById = nodes.reduce(
      (acc, curr, index) => {
        acc[curr.key] = index;
        return acc;
      },
      {} as Record<string, number>
    );

    const edges: { source: number; target: number; weight: number }[] = [];
    const edgesIndex: Record<string, number> = {};
    this.trainSchedules.forEach((ts) => {
      let prevInNodeArrayIndex: number | null = null;
      ts.path.forEach((item) => {
        // create edges
        const targetKey = OsrdNgeSync.getPathKey(item);
        const targetNodeIndexInNodeArray = nodeIndexById[targetKey];
        if (prevInNodeArrayIndex) {
          const edgeIndexKey = `${prevInNodeArrayIndex}-${targetNodeIndexInNodeArray}`;
          if (edgesIndex[edgeIndexKey]) {
            edges[edgesIndex[edgeIndexKey]].weight += 1;
          } else {
            const newLength = edges.push({
              source: prevInNodeArrayIndex,
              target: targetNodeIndexInNodeArray,
              weight: 1,
            });
            edgesIndex[edgeIndexKey] = newLength - 1;
          }
        }
        prevInNodeArrayIndex = targetNodeIndexInNodeArray;
      });
    });

    return {
      nodes,
      edges,
    };
  }

  /**
   * Apply a layout on nodes and save the new position.
   * Nodes that are saved are fixed.
   */
  private applyLayout() {
    const graph = this.toGraph();
    if (graph.nodes.some((n) => !n.fixed)) {
      const layout = new Layout()
        .defaultNodeSize(100)
        .size([800, 600])
        .linkDistance(200)
        .avoidOverlaps(true)
        .nodes(graph.nodes)
        .links(graph.edges)
        .start(5, 10, 15, 20, false, true);

      layout.nodes().forEach((n) => {
        const node = n as ColaNode & { key: string };
        this.updateNodeDataByKey(node.key, {
          position_x: node.x,
          position_y: node.y,
        });
      });
    }
  }

  /**
   * Get nodes of the scenario that are saved in the DB.
   */
  private async apiGetSavedNodes(): Promise<MacroNodeResponse[]> {
    const pageSize = 100;
    let page = 1;
    let reachEnd = false;
    const result: MacroNodeResponse[] = [];
    while (!reachEnd) {
      const promise = this.dispatch(
        osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodes.initiate(
          {
            projectId: this.scenario.project.id,
            studyId: this.scenario.study_id,
            scenarioId: this.scenario.id,
            pageSize,
            page,
          }
        )
      );
      // need to unsubscribe on get call to avoid cache issue
      promise.unsubscribe();
      const { data } = await promise;
      if (data) result.push(...data.results);
      reachEnd = isNil(data?.next);
      page += 1;
    }
    return result;
  }

  private async apiCreateNode(node: Omit<MacroNodeResponse, 'id'>) {
    try {
      const createPromise = this.dispatch(
        osrdEditoastApi.endpoints.postProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodes.initiate(
          {
            projectId: this.scenario.project.id,
            studyId: this.scenario.study_id,
            scenarioId: this.scenario.id,
            macroNodeForm: node,
          }
        )
      );
      const newNode = await createPromise.unwrap();
      this.indexNode(newNode, true);
    } catch (e) {
      console.error(e);
    }
  }

  private async apiUpdateNode(node: MacroNodeResponse) {
    try {
      await this.dispatch(
        osrdEditoastApi.endpoints.putProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeId.initiate(
          {
            projectId: this.scenario.project.id,
            studyId: this.scenario.study_id,
            scenarioId: this.scenario.id,
            nodeId: node.id,
            macroNodeForm: node,
          }
        )
      );
      this.indexNode(node, true);
    } catch (e) {
      console.error(e);
    }
  }

  private async apiDeleteNode(node: MacroNodeResponse) {
    try {
      await this.dispatch(
        osrdEditoastApi.endpoints.deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodesNodeId.initiate(
          {
            projectId: this.scenario.project.id,
            studyId: this.scenario.study_id,
            scenarioId: this.scenario.id,
            nodeId: node.id,
          }
        )
      );
      this.deleteNodeByKey(node.path_item_key);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Cast a NGE node to a node.
   */
  static castNgeNode(
    node: NetzgrafikDto['nodes'][0],
    labels: NetzgrafikDto['labels']
  ): Omit<MacroNodeResponse, 'path_item_key'> {
    return {
      id: node.id,
      trigram: node.betriebspunktName,
      full_name: node.fullName,
      connection_time: node.connectionTime,
      position_x: node.positionX,
      position_y: node.positionY,
      labels: node.labelIds
        .map((id) => {
          const ngeLabel = labels.find((e) => e.id === id);
          if (ngeLabel) return ngeLabel.label;
          return null;
        })
        .filter((n) => n !== null) as string[],
    };
  }

  /**
   * Given an path step, returns its opId
   */
  static getPathKey(item: TrainScheduleResult['path'][0]): string {
    if ('trigram' in item)
      return `trigram:${item.trigram}${item.secondary_code ? `/${item.secondary_code}` : ''}`;
    if ('operational_point' in item) return `op_id:${item.operational_point}`;
    if ('uic' in item) return `uic:${item.uic}`;
    if ('track' in item && 'offset' in item) return `track_offset:${item.track}+${item.offset}`;

    // Error
    console.error(`Can't find an path ID for ${JSON.stringify(item)}`);
    throw new Error(`Can't find an path ID for ${JSON.stringify(item)}`);
  }

  /**
   * Given a search result item, returns all possible opIds, ordered by weight.
   */
  static getPathKeys(item: SearchResultItemOperationalPoint): string[] {
    const result = [];
    result.push(`op_id:${item.obj_id}`);
    result.push(`trigram:${item.trigram}${'ch' in item ? `/${item.ch}` : ''}`);
    result.push(`uic:${item.uic}`);
    item.track_sections.forEach((ts) => {
      result.push(`track_offset:${ts.track}+${ts.position}`);
    });
    return result;
  }
}
