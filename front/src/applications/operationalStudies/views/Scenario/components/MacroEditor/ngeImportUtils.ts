import type { NodeIndexed } from './MacroEditorState';

export const relabelDuplicateTrigrams = (
  macroNodes: Omit<NodeIndexed, 'dbId'>[]
): Omit<NodeIndexed, 'dbId'>[] => {
  const trigramsToIds: Record<string, number[]> = {};
  for (const node of macroNodes) {
    if (!trigramsToIds[node.trigram!]) trigramsToIds[node.trigram!] = [];
    trigramsToIds[node.trigram!].push(node.ngeId);
  }

  const macroNodesWUniqueTrigrams = [];
  for (const node of macroNodes) {
    const trigramIds = trigramsToIds[node.trigram!];
    if (trigramIds.length == 1) macroNodesWUniqueTrigrams.push(node);
    else {
      const idIndex = trigramIds.findIndex((id) => id === node.ngeId);
      macroNodesWUniqueTrigrams.push({ ...node, trigram: `${node.trigram}-${idIndex}` });
    }
  }
  return macroNodesWUniqueTrigrams;
};
