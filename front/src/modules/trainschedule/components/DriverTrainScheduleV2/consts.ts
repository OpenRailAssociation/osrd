export enum BaseOrEco {
  base = 'base',
  eco = 'eco',
}

export type BaseOrEcoType = keyof typeof BaseOrEco;

export const BASE_OR_ECO_OPTIONS = [
  {
    label: BaseOrEco.base,
    value: BaseOrEco.base,
  },
  {
    label: BaseOrEco.eco,
    value: BaseOrEco.eco,
  },
];
