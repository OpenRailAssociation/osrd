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
  name: !project.name || project.name.length > 128,
  objectives: (project.objectives ?? '').length > 4096,
  description: (project.description ?? '').length > 1024,
  funders: (project.funders ?? '').length > 255,
  budget: (project.budget ?? 0) > 2147483647,
});

export default checkProjectFields;
