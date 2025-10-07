import type { NetzgrafikDto } from './types';

export const EMPTY_DTO: NetzgrafikDto = {
  nodes: [],
  trainruns: [],
  trainrunSections: [],
  resources: [],
  metadata: {
    netzgrafikColors: [],
    trainrunCategories: [],
    trainrunFrequencies: [],
    trainrunTimeCategories: [],
  },
  labels: [],
  labelGroups: [],
  freeFloatingTexts: [],
  filterData: {
    filterSettings: [],
  },
};
