import { getTranslations } from '../../utils';
import readJsonFile from '../../utils/file-utils';
import type { StdcmTranslations } from '../../utils/types';

const enTranslations: StdcmTranslations = readJsonFile('public/locales/en/stdcm.json');
const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

const tractionEngineName = 'ELECTRIC_RS_E2E';
const towedRollingStockName = '-';
const compositionCode = 'HLP';
const tonnage = '950 t';
const length = '567 m';
const maxSpeed = '100 km/h';
const origin = 'North_West_station';
const destination = 'South_station';
const departureTime = '20:21';

const getMailFeedbackData = () => {
  const translations = getTranslations({
    en: enTranslations,
    fr: frTranslations,
  });

  const expectedSubject = translations.mailFeedback.subject.replace('{{stdcmName}}', 'Stdcm');

  const expectedBody = `
********

${translations.mailFeedback.simulationDetails}:

${translations.consist.tractionEngine}: ${tractionEngineName}
${translations.consist.towedRollingStock}: ${towedRollingStockName}
${translations.consist.compositionCode}: ${compositionCode}
${translations.consist.tonnage}: ${tonnage}
${translations.consist.length}: ${length}
${translations.consist.maxSpeed}: ${maxSpeed}

${translations.trainPath.origin}: ${origin}
${translations.trainPath.destination}: ${destination}
${translations.departureTime}: ${departureTime}

********

${translations.mailFeedback.body.replace('{{stdcmName}}', 'Stdcm')}

********
`;

  const expectedMail = 'support_LMR@default.org';

  return { expectedSubject, expectedBody, expectedMail };
};

export default getMailFeedbackData;
