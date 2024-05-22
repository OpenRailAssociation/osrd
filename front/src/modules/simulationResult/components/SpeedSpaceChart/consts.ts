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
