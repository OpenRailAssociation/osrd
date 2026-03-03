export const SCENARIO_DATA = {
  name: 'scenario_test_e2e',
  description: 'scenario description',
  tags: ['tag1', 'tag2', 'tag3'],
};

export const UPDATED_SCENARIO_DATA = {
  tags: ['update-tag'],
  description: SCENARIO_DATA.description + ' (updated)',
};

export const SCENARIO_URLS = {
  study: (projectId: number, studyId: number) =>
    `/operational-studies/projects/${projectId}/studies/${studyId}`,
  scenario: (projectId: number, studyId: number, scenarioId: number) =>
    `/operational-studies/projects/${projectId}/studies/${studyId}/scenarios/${scenarioId}`,
  detail: '**/scenarios/*',
};
