import { omit } from 'lodash';

import type {
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

const NODES_LOCAL_STORAGE_KEY = 'macro_nodes';

type NodeIndex = {
  node: {
    id: number;
    opId: string;
    trigram: string;
    fullName: string;
    positionX: number;
    positionY: number;
    connectionTime: number;
    labels: string[];
  };
  saved: boolean;
};
export default class OsrdNgeSync {
  /**
   * Storing nodes by op ID
   * It's the main storage for node.
   * The saved attribut is to know if the data comes from the local storage or from NGE
   */
  private nodesByOpId: Record<string, NodeIndex>;

  /**
   * We keep a dictionnary of id/OpId to be able to find a node by its id
   */
  private nodesIdToOpId: Record<number, string>;

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
    this.nodesIdToOpId = {};
    this.nodesByOpId = {};
    this.ngeResource = { id: 1, capacity: trainSchedules.length };
  }

  /**
   * Load & index the data of the train schedule for the given scenario
   */
  async importTimetable(): Promise<void> {
    // Load path items
    this.trainSchedules
      .map((schedule) => schedule.path)
      .flat()
      .forEach((pathItem, index) => {
        const opId = OsrdNgeSync.findOpIdFromPathItem(pathItem);
        if (!this.getNodeByOpId(opId)) {
          const macroNode = {
            id: index,
            opId,
            connectionTime: 0,
            trigram: 'trigram' in pathItem ? pathItem.trigram : '',
            fullName: '',
            labels: [],
            positionX: index * 200,
            positionY: 0,
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
      OsrdNgeSync.getPossibleOpIdsForPathItem(searchResult).forEach((opId) => {
        this.updateNodeDataByOpId(opId, macroNode);
      });
    });

    // Load saved node and update the indexed nodes
    const savedNodes = OsrdNgeSync.getAllSavedNodes();
    savedNodes
      .filter((n) => n.timetableId === this.scenario.timetable_id)
      .forEach((n) => {
        this.updateNodeDataByOpId(n.opId, n, true);
      });

    this.convertGeoCoords();

    // Index trainschedule labels
    this.trainSchedules.forEach((ts) => {
      ts.labels?.forEach((l) => {
        this.labels.add(l);
      });
    });
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

  public handleNgeNodeOperation(
    type: NGEEvent['type'],
    node: NodeDto,
    netzgrafikDto: NetzgrafikDto
  ) {
    const indexNode = this.getNodeById(node.id);
    switch (type) {
      case 'create':
      case 'update': {
        if (indexNode) {
          this.updateNodeDataByOpId(
            indexNode.node.opId,
            OsrdNgeSync.castNgeNode(indexNode.node.opId, node, netzgrafikDto.labels),
            true
          );
        } else {
          // It's an unknown node, we need to create it
          // We assume that `betriebspunktName` is a trigram and so an opId
          const opId = `trigram:${node.betriebspunktName}`;
          this.indexNode(OsrdNgeSync.castNgeNode(opId, node, netzgrafikDto.labels), true);
        }
        this.saveNodes();
        break;
      }
      case 'delete': {
        if (indexNode) {
          this.deleteNodeByOpId(indexNode.node.opId);
          this.saveNodes();
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Store and index the node.
   */
  private indexNode(node: NodeIndex['node'], saved = false) {
    // Remove in the id index, its previous value
    const currentValue = this.getNodeByOpId(node.opId);
    if (currentValue) {
      const prevId = currentValue.node.id;
      delete this.nodesIdToOpId[prevId];
    }

    // Index
    this.nodesByOpId[node.opId] = { node, saved };
    this.nodesIdToOpId[node.id] = node.opId;
    node.labels.forEach((l) => {
      if (l) this.labels.add(l);
    });
  }

  /**
   * Update node's data by it's key
   */
  private updateNodeDataByOpId(
    opId: string,
    data: Partial<NodeIndex['node']>,
    saved: undefined | boolean = undefined
  ) {
    const indexedNode = this.getNodeByOpId(opId);
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
  private deleteNodeByOpId(opId: string) {
    const indexedNode = this.getNodeByOpId(opId);
    if (indexedNode) {
      delete this.nodesByOpId[indexedNode.node.opId];
      delete this.nodesIdToOpId[indexedNode.node.id];
    }
  }

  /**
   * Get a node by its opId.
   */
  private getNodeByOpId(opId: string): NodeIndex | null {
    return this.nodesByOpId[opId] || null;
  }

  /**
   * Get a node by its id.
   */
  private getNodeById(id: number) {
    const opId = this.nodesIdToOpId[id];
    return this.getNodeByOpId(opId);
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
          const node = this.getNodeByOpId(OsrdNgeSync.findOpIdFromPathItem(pathItem));
          return node!.node.opId;
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
              this.getNodeByOpId(sourceNodeOpId)!.node
            );
          }
          const sourceNode = ngeNodesByPathKey[sourceNodeOpId];

          // Get the target node or created it
          const targetNodeKey = pathNodeKeys[i + 1];
          if (!ngeNodesByPathKey[targetNodeKey]) {
            ngeNodesByPathKey[targetNodeKey] = this.castNodeToNge(
              this.getNodeByOpId(targetNodeKey)!.node
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
      fullName: node.fullName || '',
      positionX: node.positionX,
      positionY: node.positionY,
      ports: [],
      transitions: [],
      connections: [],
      resourceId: this.ngeResource.id,
      perronkanten: 10,
      connectionTime: node.connectionTime,
      trainrunCategoryHaltezeiten: TRAINRUN_CATEGORY_HALTEZEITEN,
      symmetryAxis: 0,
      warnings: [],
      labelIds: (node.labels || [])?.map((l) => labelsList.findIndex((e) => e === l)),
    };
  }

  /**
   * Convert geographic coordinates (latitude/longitude) into screen coordinates
   * (pixels).
   */
  private convertGeoCoords() {
    // Don't change coordinates of saved nodes
    const nodes = Object.values(this.nodesByOpId)
      .filter((n) => !n.saved)
      .map((n) => n.node);

    const xCoords = nodes.map((node) => node.positionX);
    const yCoords = nodes.map((node) => node.positionY);
    const minX = Math.min(...xCoords);
    const minY = Math.min(...yCoords);
    const maxX = Math.max(...xCoords);
    const maxY = Math.max(...yCoords);
    const width = maxX - minX;
    const height = maxY - minY;
    // TODO: grab NGE component size
    const scaleX = 800;
    const scaleY = 500;
    const padding = 0.1;

    for (const node of nodes) {
      const normalizedX = (node.positionX - minX) / (width || 1);
      const normalizedY = 1 - (node.positionY - minY) / (height || 1);
      const paddedX = normalizedX * (1 - 2 * padding) + padding;
      const paddedY = normalizedY * (1 - 2 * padding) + padding;

      this.updateNodeDataByOpId(node.opId, {
        positionX: scaleX * paddedX,
        positionY: scaleY * paddedY,
      });
    }
  }

  /**
   * Cast a NGE node to a node.
   */
  static castNgeNode(
    opId: string,
    node: NetzgrafikDto['nodes'][0],
    labels: NetzgrafikDto['labels']
  ): NodeIndex['node'] {
    return {
      id: node.id,
      opId,
      trigram: node.betriebspunktName,
      fullName: node.fullName,
      connectionTime: node.connectionTime,
      positionX: node.positionX,
      positionY: node.positionY,
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
   * Save the current nodes in the local storage.
   */
  private saveNodes() {
    const currentTimetableEntriesToSave = Object.values(this.nodesByOpId)
      .filter((n) => n.saved)
      .map((n) => ({ ...omit(n.node, ['id']), timetableId: this.scenario.timetable_id }));

    const otherEntries = OsrdNgeSync.getAllSavedNodes().filter(
      (n) => n.timetableId !== this.scenario.timetable_id
    );

    localStorage.setItem(
      NODES_LOCAL_STORAGE_KEY,
      JSON.stringify([...currentTimetableEntriesToSave, ...otherEntries])
    );
  }

  /**
   * Get nodes that are saved in local storage (not filtered).
   */
  static getAllSavedNodes(): Array<Omit<NodeIndex['node'], 'id'> & { timetableId: number }> {
    let nodes: Array<Omit<NodeIndex['node'], 'id'> & { timetableId: number }> = [];
    const rawNodes = localStorage.getItem(NODES_LOCAL_STORAGE_KEY);
    if (rawNodes) {
      const parsedNodes = JSON.parse(rawNodes);
      if (Array.isArray(parsedNodes)) {
        nodes = parsedNodes;
      } else {
        console.error(
          `Error loading nodes from localStorage: expected an array, but received: '${typeof parsedNodes}' type.`
        );
      }
    }

    return nodes;
  }

  /**
   * Given an path step, returns its opId
   */
  static findOpIdFromPathItem(item: TrainScheduleResult['path'][0]): string {
    if ('trigram' in item)
      return `trigram:${item.trigram}${item.secondary_code ? `/${item.secondary_code}` : ''}`;
    if ('op_id' in item) return `op_id:${item.op_id}`;
    if ('uic' in item) return `uic:${item.uic}`;
    if ('track' in item && 'offset' in item) return `track_offset:${item.track}+${item.offset}`;

    // Error
    console.error(`Can't find an path ID for ${JSON.stringify(item)}`);
    throw new Error(`Can't find an path ID for ${JSON.stringify(item)}`);
  }

  /**
   * Given a search result item, returns all possible opIds, ordered by weight.
   */
  static getPossibleOpIdsForPathItem(item: SearchResultItemOperationalPoint): string[] {
    const result = [];
    result.push(`uic:${item.uic}`);
    result.push(`trigram:${item.trigram}${'ch' in item ? `/${item.ch}` : ''}`);
    item.track_sections.forEach((ts) => {
      result.push(`track_offset:${ts.track}+${ts.position}`);
    });
    return result;
  }
}
