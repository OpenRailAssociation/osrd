export const PROJECT_URLS = {
  list: '/operational-studies/projects',
  detail: '**/projects/*',
};

export const PROJECT_DATA = {
  name: 'project_test_e2e',
  objectives:
    '# Title 1 \n## Title 2 \n### Title 3  \n* List item  \n- [ ] List item with checkbox',
  description: 'This is an e2e test for the project description',
  funders: 'Funded by developers',
  budget: '1234567890',
  tags: ['tag1', 'tag2', 'tag3'],
};

export const UPDATED_PROJECT_DATA = {
  description: `${PROJECT_DATA.description} (updated)`,
  objectives: `${PROJECT_DATA.objectives} (updated)`,
  funders: `${PROJECT_DATA.funders} (updated)`,
  budget: '123456789',
  tags: ['update-tag'],
};
