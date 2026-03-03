import { readJsonFile } from '../../utils/file-utils';
import type { StudyFrTranslations } from '../../utils/types';

const frTranslations: StudyFrTranslations = readJsonFile(
  'public/locales/fr/operational-studies.json'
);

export const STUDY_TRANSLATIONS = {
  type: {
    flowRate: frTranslations.study.studyCategories.flowRate,
  },
  status: {
    started: frTranslations.study.studyStates.started,
  },
};
export const STUDY_DATA = {
  name: 'study_test_e2e',
  description: 'This is an e2e test for the study description',
  budget: '1234567890',
  serviceCode: 'A1234',
  businessCode: 'B1234',
  startDate: '2023-02-02',
  expectedEndDate: '2023-02-02',
  actualEndDate: '2023-02-02',
  state: 'started',
  studyType: 'flowRate',
  tags: ['tag1', 'tag2', 'tag3'],
};

export const UPDATED_STUDY_DATA = {
  serviceCode: 'A1230',
  businessCode: 'B1230',
  budget: '123456789',
  tags: ['update-tag'],
  type: frTranslations.study.studyCategories.operability,
  status: frTranslations.study.studyStates.inProgress,
};

export const STUDY_URLS = {
  project: (projectId: number) => `/operational-studies/projects/${projectId}`,
  study: (projectId: number, studyId: number) =>
    `/operational-studies/projects/${projectId}/studies/${studyId}`,
  detail: '**/studies/*',
};
