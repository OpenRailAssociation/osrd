import type { ConsistChangeFields, ConsistFields } from '../../../utils/stdcm-types';
import type { PdfConsistChangeContent } from '../../../utils/types';
import { electricRollingStockName, towedRollingStockName } from '../project-const';
import { DEFAULT_DETAILS, STDCM_TRANSLATIONS } from './stdcm-const';

// TODO: remove dependency to lodash in src/utils/strings.ts
// to allow the file to be imported in e2e tests
export function capitalizeFirstLetter(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export const CONSIST_CHANGE_VIA_STOP_TIME = '3';

export const INITIAL_CONSIST_DETAILS: ConsistFields = {
  tractionEngine: electricRollingStockName,
  tonnage: '950',
  length: '400',
  speedLimitTag: 'HLP',
  maxSpeed: '100',
};

export const CONSIST_CHANGE_INITIAL_PREFILL: ConsistChangeFields = {
  tractionEngine: electricRollingStockName,
  towedRollingStock: '',
  tonnage: INITIAL_CONSIST_DETAILS.tonnage ?? '0',
  length: INITIAL_CONSIST_DETAILS.length ?? '0',
};

export const CONSIST_CHANGE_ORIGIN_DETAILS = {
  input: 'North',
  chValue: DEFAULT_DETAILS.chValue,
  arrivalType: 'preciseTime',
  arrivalDate: '18/10/24',
  arrivalTime: '22:49',
  tolerance: {
    negative: '-60',
    positive: '+60',
  },
};

export const CONSIST_CHANGE_DETAILS: ConsistChangeFields = {
  tonnage: '948',
  length: '500',
  tractionEngine: electricRollingStockName,
  towedRollingStock: towedRollingStockName,
};

export const CONSIST_CHANGE_UPDATED_PREFILL: ConsistChangeFields = {
  tractionEngine: electricRollingStockName,
  towedRollingStock: towedRollingStockName,
  tonnage: CONSIST_CHANGE_DETAILS.tonnage,
  length: CONSIST_CHANGE_DETAILS.length,
};

export const CONSIST_CHANGE_TRANSITIONS = {
  tonnage: `(${INITIAL_CONSIST_DETAILS.tonnage}t  ${CONSIST_CHANGE_DETAILS.tonnage}t)`,
  length: `(${INITIAL_CONSIST_DETAILS.length}m  ${CONSIST_CHANGE_DETAILS.length}m)`,
};

export const CONSIST_CHANGE_PDF_CONTENT: PdfConsistChangeContent = {
  simulationTableLabel: STDCM_TRANSLATIONS.consist.consistChange,
  sectionHeader: STDCM_TRANSLATIONS.reportSheet.consistChange,
  changes: `\u2022 Mid_West_s\u2026 ${DEFAULT_DETAILS.chValue}`,
  massList: [`1. ${INITIAL_CONSIST_DETAILS.tonnage} t`, `2. ${CONSIST_CHANGE_DETAILS.tonnage} t`],
  lengthList: [`1. ${INITIAL_CONSIST_DETAILS.length} m`, `2. ${CONSIST_CHANGE_DETAILS.length} m`],
  rollingStockList: ['1. ELEC-\nTRIC_RS_E2E', '2. ELEC-\nTRIC_RS_E2E'],
  towedRollingStockList: ['1. -', `2. ${towedRollingStockName}`],
  simulationTableContent: [
    `${CONSIST_CHANGE_DETAILS.tonnage} t ${CONSIST_CHANGE_DETAILS.length} m ${CONSIST_CHANGE_DETAILS.tractionEngine} ${capitalizeFirstLetter(STDCM_TRANSLATIONS.trainPath.stopType.consistChange)}`,
    `${STDCM_TRANSLATIONS.consist.consistChange} ${STDCM_TRANSLATIONS.reportSheet.weight} (${INITIAL_CONSIST_DETAILS.tonnage} t → ${CONSIST_CHANGE_DETAILS.tonnage} t), ${STDCM_TRANSLATIONS.reportSheet.length} (${INITIAL_CONSIST_DETAILS.length} m → ${CONSIST_CHANGE_DETAILS.length} m)`,
  ],
};
