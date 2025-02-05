import { getTranslations, readJsonFile } from '../utils';
import { getLocalizedDateString } from '../utils/date';
import type { Simulation } from '../utils/types';

const enTranslations = readJsonFile('public/locales/en/stdcm-simulation-report-sheet.json');
const frTranslations = readJsonFile('public/locales/fr/stdcm-simulation-report-sheet.json');

const simulationSheetDetails = (): Simulation => {
  const translations = getTranslations({
    en: enTranslations,
    fr: frTranslations,
  });
  return {
    header: {
      toolDescription: translations.warningMessage,
      documentTitle: translations.stdcm,
    },
    applicationDate: translations.applicationDate,

    applicationDateValue: getLocalizedDateString('2024-10-17'),

    trainDetails: {
      compositionCode: translations.speedLimitByTag,
      compositionCodeValue: 'HLP',
      towedMaterial: translations.towedMaterial,
      towedMaterialValue: '-',
      maxSpeed: translations.maxSpeed,
      maxSpeedValue: '100 km/h',
      maxTonnage: translations.maxWeight,
      maxTonnageValue: '950 t',
      referenceEngine: translations.referenceEngine,
      referenceEngineValue: 'ELECTRIC_RS_E2E',
      maxLength: translations.maxLength,
      maxLengthValue: '567 m',
    },
    requestedRoute: {
      station1: {
        name: '1 North_West_station',
        ch: 'BV',
        plusTolerance: '+60',
        minusTolerance: '-15',
        departureTime: '20:21',
        reason: translations.serviceStop,
      },
      station2: {
        name: '2 Mid_West_station',
        ch: 'BV',
        reason: translations.passageStop,
      },
      station3: {
        name: '3 South_station',
        ch: 'BV',
        arrivalTime: translations.asap,
        reason: translations.serviceStop,
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
          stopType: translations.serviceStop,
        },
        station2: {
          name: '2 Mid_West_station',
          ch: 'BV',
          track: 'V1',
          passageTime: '20:42',
          tonnage: '=',
          length: '=',
          stopType: translations.passageStop,
        },
        station3: {
          name: '3 Mid_East_station',
          ch: 'BV',
          track: 'V1',
          passageTime: '20:50',
          tonnage: '=',
          length: '=',
        },
        station4: {
          name: '4 North_station',
          ch: 'BV',
          track: 'V1bis',
          passageTime: '21:01',
          tonnage: '=',
          length: '=',
        },
        station5: {
          name: '5 South_station',
          ch: 'BV',
          track: 'V1',
          arrivalTime: '21:06',
          tonnage: '=',
          length: '=',
          stopType: translations.serviceStop,
        },
      },
      disclaimer: translations.withoutWarranty,
    },
  };
};

export default simulationSheetDetails;
