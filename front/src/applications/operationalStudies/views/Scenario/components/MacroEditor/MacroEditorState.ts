import { sortBy } from 'lodash';

import type {
  MacroNodeResponse,
  OperationalPoint,
  PathItemLocation,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';

import type { TrainrunCategory, TrainrunFrequency } from '../NGE/types';

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
   * Study id
   */
  studyId: number;

  /**
   * Project id
   */
  projectId: number;

  /**
   * Nodes storage
   * Type null is here due to deletion, to avoid recomputing indices.
   * We are not building a db engine, so we can afford to have some null values.
   */
  nodes: Array<NodeIndexed | null> = [];

  /**
   * Given a path key, returns the node index in the nodes storage.
   */
  indexByPathKey: Record<string, number>;

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
   * Given a NGE `Trainrun.id`, returns the OSRD `TimetableItemId`.
   */
  timetableItemIdByNgeId: Map<number, [TimetableItemId, TimetableItemId | null]>;

  /**
   * Default constructor
   */
  constructor(infraId: number, scenarioId: number, studyId: number, projectId: number) {
    this.nodeLabels = new Set<string>([]);
    this.trainrunLabels = new Set<string>([]);
    this.noteLabels = new Set<string>([]);
    this.nodes = [];
    this.indexByPathKey = {};
    this.indexByNgeId = {};
    this.ngeNoteIdToDbId = new Map();
    this.infraId = infraId;
    this.scenarioId = scenarioId;
    this.studyId = studyId;
    this.projectId = projectId;
    this.trainrunFrequencies = [];
    this.trainrunCategories = [];
    this.ngeResource = { id: 1, capacity: 0 };
    this.timetableItemIdByNgeId = new Map();
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
  dedupNodes(): void {
    const trigramAggreg = Object.entries(this.indexByPathKey)
      .map(([_, indexInStorage]) => {
        const node = this.nodes[indexInStorage];
        return node ? { key: node.path_item_key, trigram: node.trigram } : null;
      })
      .filter((i) => i !== null && i.trigram)
      .reduce(
        (acc, curr) => {
          acc[curr!.trigram!] = [...(acc[curr!.trigram!] || []), curr!.key];
          return acc;
        },
        {} as Record<string, string[]>
      );

    for (const trig of Object.keys(trigramAggreg)) {
      if (trigramAggreg[trig].length < 2) {
        delete trigramAggreg[trig];
      }
      trigramAggreg[trig] = sortBy(trigramAggreg[trig], (key) => {
        const node = this.nodes[this.indexByPathKey[key]];
        if (node?.dbId) return 0;
        if (key.startsWith('op_id:')) return 1;
        if (key.startsWith('trigram:')) return 2;
        if (key.startsWith('uic:')) return 3;
        // default
        return 4;
      });
    }

    Object.values(trigramAggreg).forEach((mergeList) => {
      const mainNodeKey = mergeList[0];
      const mainNodeIndex = this.indexByPathKey[mainNodeKey];
      mergeList.slice(1).forEach((key) => {
        // Delete the node
        const nodeIndexInStorage = this.indexByPathKey[key];
        this.deleteByIndexStorage(nodeIndexInStorage);
        // Update the indices to redirect to the main one
        this.indexByPathKey[key] = mainNodeIndex;
      });
    });
  }

  /**
   * Store and index the node.
   */
  indexNodeByKey(key: string, node: NodeIndexed) {
    let nodeIndexInStorage = this.indexByPathKey[key];
    if (nodeIndexInStorage !== undefined) {
      // if there is previous value, we clean the indices
      const prevNode = this.nodes[nodeIndexInStorage]!;
      delete this.indexByNgeId[prevNode.ngeId];
      delete this.indexByPathKey[key];
      // replace the node
      this.nodes[nodeIndexInStorage] = node;
    } else {
      // we add the new node in the storage
      nodeIndexInStorage = this.nodes.length;
      this.nodes.push(node);
    }

    // Update the indices
    this.indexByPathKey[node.path_item_key] = nodeIndexInStorage;
    this.indexByNgeId[node.ngeId] = nodeIndexInStorage;

    // Index labels
    node.labels.forEach((l) => {
      if (l) this.nodeLabels.add(l);
    });
  }

  /**
   * Update node's data by its key
   */
  updateNodeDataByKey(key: string, data: Partial<NodeIndexed>) {
    const indexedNode = this.getNodeByKey(key);
    if (indexedNode) {
      this.indexNodeByKey(key, { ...indexedNode, ...data });
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
   * Get a node by its key.
   */
  getNodeByKey(key: string): NodeIndexed | null {
    const index = this.indexByPathKey[key];
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
    [this.indexByPathKey, this.indexByPathKey, this.indexByNgeId].forEach((index) => {
      Object.keys(index).forEach((key) => {
        if (index[key] === indexInStorage) delete index[key];
      });
    });
    // we set value to null to avoid recomputing indices
    this.nodes[indexInStorage] = null;
  }

  /**
   * Given an path step, returns its pathKey
   */
  static getPathKey(item: PathItemLocation): string {
    if ('trigram' in item)
      return `trigram:${item.trigram}${item.secondary_code ? `/${item.secondary_code}` : ''}`;
    if ('operational_point' in item) return `op_id:${item.operational_point}`;
    if ('uic' in item)
      return `uic:${item.uic}${item.secondary_code ? `/${item.secondary_code}` : ''}`;

    return `track_offset:${item.track}+${item.offset}`;
  }

  /**
   * Given a search result item, returns all possible pathKeys, ordered by weight.
   */
  static getPathKeys(op: OperationalPoint): string[] {
    const { uic } = op.extensions?.identifier ?? {};
    const { trigram, ch } = op.extensions?.sncf ?? {};

    const result = [];
    result.push(`op_id:${op.id}`);
    if (trigram) result.push(`trigram:${trigram}${ch ? `/${ch}` : ''}`);
    if (uic) result.push(`uic:${uic}${ch ? `/${ch}` : ''}`);
    for (const opPart of op.parts) {
      result.push(`track_offset:${opPart.track}+${opPart.position}`);
    }
    return result;
  }

  static parsePathKey(key: string): PathItemLocation {
    const [type, value] = key.split(':');
    if (!value) throw new Error('Invalid path key');
    switch (type) {
      case 'op_id': {
        return { operational_point: value };
      }
      case 'trigram': {
        const [trigram, secondary_code] = value.split('/');
        return { trigram, secondary_code };
      }
      case 'uic': {
        const [uic, secondary_code] = value.split('/');
        return { uic: Number(uic), secondary_code };
      }
      case 'track_offset': {
        const [track, offset] = value.split('+');
        return { track, offset: Number(offset) };
      }
      default:
        throw new Error(`Invalid path key type "${type}"`);
    }
  }
}
