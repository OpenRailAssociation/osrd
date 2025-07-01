import readJsonFile from '../../utils/file-utils';
import type { StdcmTranslations } from '../../utils/types';

const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

const tractionEngineName = 'ELECTRIC_RS_E2E';
const towedRollingStockName = '-';
const compositionCode = 'HLP';
const loadingGauge = 'GA';
const tonnage = '950 t';
const length = '567 m';
const maxSpeed = '100 km/h';
const origin = 'North_West_station';
const destination = 'South_station';
const departureTime = '20:21';

const getMailFeedbackData = () => {
  const expectedSubject = frTranslations.mailFeedback.subject.replace('{{stdcmName}}', 'Stdcm');

  const expectedBody = `
********

${frTranslations.mailFeedback.simulationDetails}:

${frTranslations.consist.tractionEngine}: ${tractionEngineName}
${frTranslations.consist.towedRollingStock}: ${towedRollingStockName}
${frTranslations.consist.compositionCode}: ${compositionCode}
${frTranslations.consist.loadingGauge}: ${loadingGauge}
${frTranslations.consist.tonnage}: ${tonnage}
${frTranslations.consist.length}: ${length}
${frTranslations.consist.maxSpeed}: ${maxSpeed}

${frTranslations.trainPath.origin}: ${origin}
${frTranslations.trainPath.destination}: ${destination}
${frTranslations.departureTime}: ${departureTime}

********

${frTranslations.mailFeedback.body.replace('{{stdcmName}}', 'Stdcm')}

********
`;

  const expectedMail = 'support_LMR@default.org';

  return { expectedSubject, expectedBody, expectedMail };
};

export default getMailFeedbackData;
