import { checkFieldInvalidity, checkNameInvalidity } from 'applications/operationalStudies/utils';

import type { ProjectForm } from './components/AddOrEditProjectModal';

const checkProjectFields = (
  project: ProjectForm
): {
  name: boolean;
  objectives: boolean;
  description: boolean;
  funders: boolean;
  budget: boolean;
} => ({
  name: checkNameInvalidity(project.name),
  objectives: checkFieldInvalidity(4096, project.objectives),
  description: checkFieldInvalidity(1024, project.description),
  funders: checkFieldInvalidity(255, project.funders),
  budget: (project.budget ?? 0) > 2147483647,
});

export default checkProjectFields;
