import type { TrainrunCategory, TrainrunFrequency } from '@osrd-project/netzgrafik-frontend';
import { sortBy } from 'lodash';

import type {
  MacroNodeResponse,
  NodeLocation,
  OperationalPoint,
  OperationalPointReference,
  PathItemLocation,
  TimetableType,
} from 'common/api/osrdEditoastApi';

export type NodeIndexed = Omit<MacroNodeResponse, 'id'> & {
  ngeId: number;
  dbId?: number;
  geocoord?: { lat: number; lng: number };
};

export default class MacroEditorState {
  /**
   * Infra id
   */
  infraId: number;

  /**
   * Scenario id
   */
  scenarioId: number;

  /**
   * Timetable id
   */
  timetableId: number;

  /**
   * Type of the scenario timetable. It drives how `start_time` is interpreted on both
   * sides of the NGE bridge: an absolute date for `CALENDAR`, an offset from the
   * timetable start for `HOURLY`.
   */
  timetableType: TimetableType;

  /**
   * Nodes storage
   * Type null is here due to deletion, to avoid recomputing indices.
   * We are not building a db engine, so we can afford to have some null values.
   */
  nodes: Array<NodeIndexed | null> = [];

  /**
   * Given a node location key, returns the node index in the nodes storage.
   */
  indexByNodeLocationKey: Record<string, number>;

  /**
   * Given a nge ID, returns the node index in the nodes storage.
   */
  indexByNgeId: Record<string, number>;

  /**
   * Trainrun frequencies populated by the timetable data.
   */
  trainrunFrequencies: TrainrunFrequency[];

  /**
   * Available trainrun categories with i18n labels.
   */
  trainrunCategories: TrainrunCategory[];

  /**
   * Storing labels for nodes
   */
  nodeLabels: Set<string>;

  /**
   * Storing labels for trainruns
   */
  trainrunLabels: Set<string>;

  /**
   * Storing labels for notes
   */
  noteLabels: Set<string>;

  /**
   * Mapping from NGE note ID to OSRD DB ID
   */
  ngeNoteIdToDbId: Map<number, number>;

  /**
   * NGE resource
   */
  ngeResource: { id: number; capacity: number };

  /**
   * Given a NGE `Trainrun.id`, returns the OSRD `TrainScheduleId`.
   */
  trainScheduleIdByNgeId: Map<number, [number, number | null]>;

  /**
   * Default constructor
   */
  constructor(
    infraId: number,
    scenarioId: number,
    timetableId: number,
    timetableType: TimetableType
  ) {
    this.nodeLabels = new Set<string>([]);
    this.trainrunLabels = new Set<string>([]);
    this.noteLabels = new Set<string>([]);
    this.nodes = [];
    this.indexByNodeLocationKey = {};
    this.indexByNgeId = {};
    this.ngeNoteIdToDbId = new Map();
    this.infraId = infraId;
    this.scenarioId = scenarioId;
    this.timetableId = timetableId;
    this.timetableType = timetableType;
    this.trainrunFrequencies = [];
    this.trainrunCategories = [];
    this.ngeResource = { id: 1, capacity: 0 };
    this.trainScheduleIdByNgeId = new Map();
  }

  /**
   * Check if we have duplicates
   * Ex: one key is short_name and an other is uic (with the same short_name), we should keep short_name
   * What we do :
   *  - Make a list of key,short_name
   *  - aggregate on short_name to build a list of key
   *  - filter if the array is of size 1 (ie, no dedup todo)
   *  - sort the keys by priority
   *  - add redirection in the nodesByPathKey
   */
  dedupNodes(): void {
    const shortNameAggreg = Object.entries(this.indexByNodeLocationKey)
      .map(([_, indexInStorage]) => {
        const node = this.nodes[indexInStorage];
        return node
          ? {
              key: MacroEditorState.getPathKeyByNodeLocation(node.node_location),
              short_name: node.short_name,
            }
          : null;
      })
      .filter((i) => i !== null && i.short_name)
      .reduce(
        (acc, curr) => {
          acc[curr!.short_name!] = [...(acc[curr!.short_name!] || []), curr!.key];
          return acc;
        },
        {} as Record<string, string[]>
      );

    for (const name of Object.keys(shortNameAggreg)) {
      if (shortNameAggreg[name].length < 2) {
        delete shortNameAggreg[name];
      }
      shortNameAggreg[name] = sortBy(shortNameAggreg[name], (key) => {
        const node = this.nodes[this.indexByNodeLocationKey[key]];
        if (node?.dbId) return 0;
        if (key.startsWith('op_id:')) return 1;
        if (key.startsWith('domestic:')) return 2;
        if (key.startsWith('uic:')) return 3;
        // default
        return 4;
      });
    }

    Object.values(shortNameAggreg).forEach((mergeList) => {
      const mainNodeKey = mergeList[0];
      const mainNodeIndex = this.indexByNodeLocationKey[mainNodeKey];
      mergeList.slice(1).forEach((key) => {
        // Delete the node
        const nodeIndexInStorage = this.indexByNodeLocationKey[key];
        this.deleteByIndexStorage(nodeIndexInStorage);
        // Update the indices to redirect to the main one
        this.indexByNodeLocationKey[key] = mainNodeIndex;
      });
    });
  }

  /**
   * Store and index the node.
   */
  indexNodeByLocation(location: NodeLocation, node: NodeIndexed) {
    const nodeLocationKey = MacroEditorState.getPathKeyByNodeLocation(location);
    let nodeIndexInStorage = this.indexByNodeLocationKey[nodeLocationKey];
    if (nodeIndexInStorage !== undefined) {
      // if there is previous value, we clean the indices
      const prevNode = this.nodes[nodeIndexInStorage]!;
      delete this.indexByNgeId[prevNode.ngeId];
      delete this.indexByNodeLocationKey[nodeLocationKey];
      // replace the node
      this.nodes[nodeIndexInStorage] = node;
    } else {
      // we add the new node in the storage
      nodeIndexInStorage = this.nodes.length;
      this.nodes.push(node);
    }

    // Update the indices
    this.indexByNodeLocationKey[nodeLocationKey] = nodeIndexInStorage;
    this.indexByNgeId[node.ngeId] = nodeIndexInStorage;

    // Index labels
    node.labels.forEach((l) => {
      if (l) this.nodeLabels.add(l);
    });
  }

  /**
   * Update node's data by its node location
   */
  updateNodeDataByNodeLocation(nodeLocation: NodeLocation, data: Partial<NodeIndexed>) {
    const indexedNode = this.getNodeByLocation(nodeLocation);
    if (indexedNode) {
      this.indexNodeByLocation(nodeLocation, { ...indexedNode, ...data });
    }
  }

  /**
   * Delete a node by its nge ID
   */
  deleteNodeByNgeId(ngeId: number) {
    const indexInStorage = this.indexByNgeId[ngeId];
    const node = this.nodes[indexInStorage];
    if (node) {
      this.deleteByIndexStorage(indexInStorage);
    }
  }

  /**
   * Get a node by its location.
   */
  getNodeByLocation(location: NodeLocation): NodeIndexed | null {
    const index = this.indexByNodeLocationKey[MacroEditorState.getPathKeyByNodeLocation(location)];
    return this.nodes[index] || null;
  }

  /**
   * Get a node by its NGE ID.
   */
  getNodeByNgeId(id: number): NodeIndexed | null {
    const index = this.indexByNgeId[id];
    return this.nodes[index] || null;
  }

  getDbIdForNote(ngeId: number): number | undefined {
    return this.ngeNoteIdToDbId.get(ngeId);
  }

  setDbIdForNote(ngeId: number, dbId: number): void {
    this.ngeNoteIdToDbId.set(ngeId, dbId);
  }

  removeNoteMapping(ngeId: number): void {
    this.ngeNoteIdToDbId.delete(ngeId);
  }

  private deleteByIndexStorage(indexInStorage: number) {
    // delete all refs in indices
    [this.indexByNodeLocationKey, this.indexByNgeId].forEach((index) => {
      Object.keys(index).forEach((key) => {
        if (index[key] === indexInStorage) delete index[key];
      });
    });
    // we set value to null to avoid recomputing indices
    this.nodes[indexInStorage] = null;
  }

  static getPathKeyByNodeLocation(item: NodeLocation): string {
    if (item.type === 'track_offset') return `track_offset:${item.track}+${item.offset}`;
    if (item.type === 'domestic') {
      return `domestic:${MacroEditorState.encodeDomesticReference(item)}`;
    }
    if (item.type === 'id') return `op_id:${item.operational_point}`;
    return `uic:${item.uic}${item.secondary_code ? `/${item.secondary_code}` : ''}`;
  }

  /**
   * Encode a domestic operational point reference in the form:
   * ${main_code}/${secondary_code}#${country_code}
   */
  static encodeDomesticReference(
    opRef: Extract<OperationalPointReference, { type: 'domestic' }>
  ): string {
    const secondaryCode = opRef.secondary_code ? `/${opRef.secondary_code}` : '';
    const countryCode = opRef.country_code === '??' ? '' : `#${opRef.country_code}`;
    return `${opRef.main_code}${secondaryCode}${countryCode}`;
  }

  /**
   * Given a search result item, returns all possible node locations, ordered by weight.
   */
  static getNodeLocations(op: OperationalPoint): NodeLocation[] {
    const { main_code, secondary_code, uic, country_code } = op;

    const result: NodeLocation[] = [{ type: 'id', operational_point: op.id }];
    if (main_code) {
      result.push({ main_code, secondary_code, country_code, type: 'domestic' });
    }
    if (uic) result.push({ type: 'uic', uic, secondary_code });
    for (const opPart of op.parts) {
      result.push({ type: 'track_offset', track: opPart.track, offset: opPart.position });
    }
    return result;
  }

  static parseNodeLocation(nodeLocation: NodeLocation): PathItemLocation {
    switch (nodeLocation.type) {
      case 'id':
      case 'domestic':
      case 'uic': {
        return {
          type: 'operational_point_part_reference',
          operational_point: nodeLocation,
        };
      }
      case 'track_offset': {
        return nodeLocation;
      }
      default:
        throw new Error(`Invalid node location "${nodeLocation}"`);
    }
  }

  /**
   * Decode a domestic operational point reference in the form:
   * ${main_code}/${secondary_code}#${country_code}
   */
  static decodeDomesticReference(
    pathKey: string
  ): Extract<OperationalPointReference, { type: 'domestic' }> {
    const [main_code_secondary_code, splitted_country_code] = pathKey.split('#');
    const [main_code, secondary_code] = main_code_secondary_code.split('/');

    const country_code = splitted_country_code ? splitted_country_code : '??';

    return { main_code, secondary_code, country_code, type: 'domestic' };
  }
}
