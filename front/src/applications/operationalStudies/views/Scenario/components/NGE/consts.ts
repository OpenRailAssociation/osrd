import type { NetzgrafikDto } from '@osrd-project/netzgrafik-frontend';

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
