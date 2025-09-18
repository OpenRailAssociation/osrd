import { describe, expect, it } from 'vitest';

import { relabelDuplicateTrigrams } from '../ngeImportUtils';

describe('relabelDuplicateTrigrams', () => {
  const baseNode = {
    fullName: '',
    positionX: 10,
    positionY: 20,
    ports: [],
    transitions: [],
    connections: [],
    resourceId: 42,
    perronkanten: 1,
    connectionTime: 2,
    trainrunCategoryHaltezeiten: {},
    symmetryAxis: 1,
    warnings: [],
    labelIds: [8],
  };
  const nodes = [
    { ...baseNode, betriebspunktName: 'AAA', id: 1 },
    { ...baseNode, betriebspunktName: 'DDD', id: 2 },
    { ...baseNode, betriebspunktName: 'BBB', id: 3 },
    { ...baseNode, betriebspunktName: 'AAA', id: 4 },
    { ...baseNode, betriebspunktName: 'AAA', id: 5 },
    { ...baseNode, betriebspunktName: 'CCC', id: 6 },
    { ...baseNode, betriebspunktName: 'DDD', id: 7 },
  ];
  const nodesWUniqueTrigrams = relabelDuplicateTrigrams(nodes);

  it('should not add or remove nodes', () => {
    expect(nodesWUniqueTrigrams.length).toBe(7);
  });

  it('should ignore unique trigrams', () => {
    expect(nodesWUniqueTrigrams[2]).toEqual({ ...baseNode, betriebspunktName: 'BBB', id: 3 });
    expect(nodesWUniqueTrigrams[5]).toEqual({ ...baseNode, betriebspunktName: 'CCC', id: 6 });
  });

  it('should relabel duplicated trigrams', () => {
    expect(nodesWUniqueTrigrams[0]).toEqual({ ...baseNode, betriebspunktName: 'AAA-0', id: 1 });
    expect(nodesWUniqueTrigrams[1]).toEqual({ ...baseNode, betriebspunktName: 'DDD-0', id: 2 });
    expect(nodesWUniqueTrigrams[3]).toEqual({ ...baseNode, betriebspunktName: 'AAA-1', id: 4 });
    expect(nodesWUniqueTrigrams[4]).toEqual({ ...baseNode, betriebspunktName: 'AAA-2', id: 5 });
    expect(nodesWUniqueTrigrams[6]).toEqual({ ...baseNode, betriebspunktName: 'DDD-1', id: 7 });
  });
});
