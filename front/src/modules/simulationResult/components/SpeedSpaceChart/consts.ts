import type { ModeV2 } from './types';

export const electricalProfileColorsWithProfile: ModeV2 = {
  '25000V': { '25000V': '#6E1E78', '22500V': '#A453AD', '20000V': '#DD87E5' },
  '1500V': {
    O: '#FF0037',
    A: '#FF335F',
    A1: '#FF335F',
    B: '#FF6687',
    B1: '#FF6687',
    C: '#FF99AF',
    D: '#FF99AF',
    E: '#FFCCD7',
    F: '#FFCCD7',
    G: '#FFF',
  },
  '15000V': '#009AA6',
  '3000V': '#1FBE00',
};

export const electricalProfileColorsWithoutProfile = {
  '25000V': '#6E1E78',
  '1500V': '#FF0037',
  '15000V': '#009AA6',
  '3000V': '#1FBE00',
};

export const electricalProfilesDesignValues = {
  '20000V': { color: 'rgb(228, 178, 132)', heightLevel: 0 },
  '22500V': { color: 'rgb(202, 149, 109)', heightLevel: 1 },
  '25000V': { color: 'rgb(175, 120, 85)', heightLevel: 2 },
  G: { color: 'rgb(171, 201, 133)', heightLevel: 0 },
  F: { color: 'rgb(171, 201, 133)', heightLevel: 0 },
  E: { color: 'rgb(156, 187, 121)', heightLevel: 1 },
  D: { color: 'rgb(142, 172, 111)', heightLevel: 2 },
  C: { color: 'rgb(125, 155, 98)', heightLevel: 3 },
  B1: { color: 'rgb(109, 139, 86)', heightLevel: 4 },
  B: { color: 'rgb(93, 123, 73)', heightLevel: 5 },
  A1: { color: 'rgb(79, 108, 62)', heightLevel: 6 },
  A: { color: 'rgb(63, 92, 51)', heightLevel: 7 },
  O: { color: 'rgb(47, 76, 38)', heightLevel: 8 },
};
