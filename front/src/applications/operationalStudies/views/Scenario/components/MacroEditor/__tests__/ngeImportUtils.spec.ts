import { describe, expect, it } from 'vitest';

import { relabelDuplicateTrigrams } from '../ngeImportUtils';

describe('relabelDuplicateTrigrams', () => {
  const baseNode = {
    path_item_key: '0',
    connection_time: 1,
    labels: [],
    position_x: 0,
    position_y: 0,
  };
  const nodes = [
    { ...baseNode, trigram: 'AAA', ngeId: 1 },
    { ...baseNode, trigram: 'DDD', ngeId: 2 },
    { ...baseNode, trigram: 'BBB', ngeId: 3 },
    { ...baseNode, trigram: 'AAA', ngeId: 4 },
    { ...baseNode, trigram: 'AAA', ngeId: 5 },
    { ...baseNode, trigram: 'CCC', ngeId: 6 },
    { ...baseNode, trigram: 'DDD', ngeId: 7 },
  ];
  const nodesWUniqueTrigrams = relabelDuplicateTrigrams(nodes);

  it('shoud not add or remove nodes', () => {
    expect(nodesWUniqueTrigrams.length).toBe(7);
  });

  it('should ignore unique trigrams', () => {
    expect(nodesWUniqueTrigrams[2]).toEqual({ ...baseNode, trigram: 'BBB', ngeId: 3 });
    expect(nodesWUniqueTrigrams[5]).toEqual({ ...baseNode, trigram: 'CCC', ngeId: 6 });
  });

  it('should relabel duplicated trigrams', () => {
    expect(nodesWUniqueTrigrams[0]).toEqual({ ...baseNode, trigram: 'AAA-0', ngeId: 1 });
    expect(nodesWUniqueTrigrams[1]).toEqual({ ...baseNode, trigram: 'DDD-0', ngeId: 2 });
    expect(nodesWUniqueTrigrams[3]).toEqual({ ...baseNode, trigram: 'AAA-1', ngeId: 4 });
    expect(nodesWUniqueTrigrams[4]).toEqual({ ...baseNode, trigram: 'AAA-2', ngeId: 5 });
    expect(nodesWUniqueTrigrams[6]).toEqual({ ...baseNode, trigram: 'DDD-1', ngeId: 7 });
  });
});
