import type { NodeDto } from '../NGE/types';

export const relabelDuplicateTrigrams = (nodes: NodeDto[]): NodeDto[] => {
  const trigramsToIds: Record<string, number[]> = {};
  for (const node of nodes) {
    if (!trigramsToIds[node.betriebspunktName]) trigramsToIds[node.betriebspunktName] = [];
    trigramsToIds[node.betriebspunktName].push(node.id);
  }

  const nodesWUniqueTrigrams = [];
  for (const node of nodes) {
    const trigramIds = trigramsToIds[node.betriebspunktName];
    if (trigramIds.length == 1) nodesWUniqueTrigrams.push(node);
    else {
      const idIndex = trigramIds.findIndex((id) => id === node.id);
      const newTrigram = `${node.betriebspunktName}-${idIndex}`;
      nodesWUniqueTrigrams.push({
        ...node,
        betriebspunktName: newTrigram,
      });
    }
  }
  return nodesWUniqueTrigrams;
};
