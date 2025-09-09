type MODES_Types = {
  [n: string]: string;
};

export const MODES: MODES_Types = Object.freeze({
  simulation: 'SIMULATION',
  stdcm: 'STDCM',
  editor: 'EDITOR',
  referenceMap: 'REFERENCE_MAP',
});

export const DEFAULT_MODE = MODES.simulation;
