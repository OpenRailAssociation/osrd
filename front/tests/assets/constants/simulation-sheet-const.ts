import { getLocalizedDateString } from '../../utils/date-utils';
import readJsonFile from '../../utils/file-utils';
import type { FlatTranslations, PdfSimulationContent } from '../../utils/types';

const frTranslations: FlatTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/stdcm.json'
).reportSheet;

const simulationSheetDetails = (): PdfSimulationContent => ({
  header: {
    toolDescription: frTranslations.warningMessage,
    documentTitle: frTranslations.stdcm,
  },
  applicationDate: frTranslations.applicationDate,

  applicationDateValue: getLocalizedDateString('2024-10-17'),

  trainDetails: {
    compositionCode: frTranslations.speedLimitByTag,
    compositionCodeValue: 'HLP',
    towedMaterial: frTranslations.towedMaterial,
    towedMaterialValue: '-',
    maxSpeed: frTranslations.maxSpeed,
    maxSpeedValue: '100 km/h',
    maxTonnage: frTranslations.maxWeight,
    maxTonnageValue: '950 t',
    referenceEngine: frTranslations.referenceEngine,
    referenceEngineValue: 'ELECTRIC_RS_E2E',
    maxLength: frTranslations.maxLength,
    maxLengthValue: '567 m',
    loadingGauge: frTranslations.loadingGauge,
    loadingGaugeValue: 'GA',
  },
  requestedRoute: {
    station1: {
      name: '1 North_West_station',
      ch: 'BV',
      minusTolerance: '-60',
      plusTolerance: '+15',
      departureTime: '20:21',
      reason: frTranslations.serviceStop,
    },
    station2: {
      name: '2 Mid_West_station',
      ch: 'BV',
      reason: frTranslations.passageStop,
    },
    station3: {
      name: '3 South_station',
      ch: 'BV',
      arrivalTime: frTranslations.asap,
      reason: frTranslations.serviceStop,
    },
  },
  simulationDetails: {
    totalDistance: '51 km',
    simulationRoute: {
      station1: {
        name: '1 North_West_station',
        ch: 'BV',
        track: 'A',
        departureTime: '20:21',
        tonnage: '950 t',
        length: '567 m',
        stopType: frTranslations.serviceStop,
      },
      station2: {
        name: '2 Mid_West_station',
        ch: 'BV',
        track: 'V1',
        passageTime: '20:30',
        tonnage: '=',
        length: '=',
        stopType: frTranslations.passageStop,
      },
      station3: {
        name: '3 Mid_East_station',
        ch: 'BV',
        track: 'V1',
        passageTime: '20:38',
        tonnage: '=',
        length: '=',
      },
      station4: {
        name: '4 North_station',
        ch: 'BV',
        track: 'V1bis',
        passageTime: '20:49',
        tonnage: '=',
        length: '=',
      },
      station5: {
        name: '5 South_station',
        ch: 'BV',
        track: 'V1',
        arrivalTime: '20:55',
        tonnage: '=',
        length: '=',
        stopType: frTranslations.serviceStop,
      },
    },
    disclaimer: frTranslations.withoutWarranty,
  },
});

export default simulationSheetDetails;
