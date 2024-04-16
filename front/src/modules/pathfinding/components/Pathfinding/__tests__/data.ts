import type { PathStep } from 'reducers/osrdconf/types';

export const origin: PathStep = {
  id: '1234',
  uic: 1234,
  coordinates: [48.38819835024553, -4.478289762812405],
};

export const vias: PathStep[] = [
  {
    id: '12345',
    uic: 12345,
    coordinates: [48.10326700633057, -1.6719908615098822],
  },
];

export const destination: PathStep = {
  id: '123456',
  uic: 123456,
  coordinates: [48.58505541984412, 7.73387081978364],
};
