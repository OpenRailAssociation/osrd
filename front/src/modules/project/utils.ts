import { isInvalidName } from 'applications/operationalStudies/utils';
import {
  SMALL_TEXT_AREA_MAX_LENGTH,
  TEXT_AREA_MAX_LENGTH,
  TEXT_INPUT_MAX_LENGTH,
  isInvalidString,
} from 'utils/strings';

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
  name: isInvalidName(project.name),
  objectives: isInvalidString(TEXT_AREA_MAX_LENGTH, project.objectives),
  description: isInvalidString(SMALL_TEXT_AREA_MAX_LENGTH, project.description),
  funders: isInvalidString(TEXT_INPUT_MAX_LENGTH, project.funders),
  budget: (project.budget ?? 0) > 2147483647,
});

export default checkProjectFields;
