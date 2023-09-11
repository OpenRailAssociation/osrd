export enum BaseOrEco {
  base = 'base',
  eco = 'eco',
}

export type BaseOrEcoType = keyof typeof BaseOrEco;
