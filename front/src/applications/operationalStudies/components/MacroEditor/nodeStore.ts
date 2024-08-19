type Node = {
  trigram: string;
  positionX: number;
  positionY: number;
};

const NODES_LOCAL_STORAGE_KEY = 'macro_nodes';

let nodesCache: Map<string, Node> | null;

const loadNodes = () => {
  if (nodesCache) return nodesCache;

  let entries = [];
  const rawNodes = localStorage.getItem(NODES_LOCAL_STORAGE_KEY);
  if (rawNodes) {
    const parsedNodes = JSON.parse(rawNodes);
    if (Array.isArray(parsedNodes)) {
      entries = parsedNodes;
    } else {
      console.error(
        `Error loading nodes from localStorage: expected an array, but received: '${typeof parsedNodes}' type.`
      );
    }
  }

  nodesCache = new Map(entries);
  return nodesCache;
};

const saveNodes = (nodes: Map<string, Node>) => {
  const entries = [...nodes.entries()];
  localStorage.setItem(NODES_LOCAL_STORAGE_KEY, JSON.stringify(entries));
};

const getNodeKey = (timetableId: number, trigram: string) => `${timetableId}:${trigram}`;

const nodeStore = {
  get(timetableId: number, trigram: string) {
    return loadNodes().get(getNodeKey(timetableId, trigram));
  },
  set(timetableId: number, node: Node) {
    // TODO: save position for nodes without trigram too
    if (!node.trigram) return;
    const nodes = loadNodes();
    nodes.set(getNodeKey(timetableId, node.trigram), node);
    saveNodes(nodes);
  },
  delete(timetableId: number, trigram: string) {
    if (!trigram) return;
    const nodes = loadNodes();
    nodes.delete(getNodeKey(timetableId, trigram));
    saveNodes(nodes);
  },
};

export default nodeStore;
