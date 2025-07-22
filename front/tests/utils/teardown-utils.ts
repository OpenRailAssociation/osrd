import type { LightRollingStock, LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';

import { deleteApiRequest, getStudy, getScenario, getProject, listApiRequest } from './api-utils';
import { logger } from '../logging-fixture';

/**
 * Delete a project by name if it exists.
 *
 * @param projectName - The name of the project to delete.
 * @returns {Promise<void>} - A promise that resolves when the project is deleted or if not found.
 */
export async function deleteProject(projectName: string): Promise<void> {
  const project = await getProject(projectName);
  if (project) {
    await deleteApiRequest(`/api/projects/${project.id}`);
  } else {
    logger.warn(`Project "${projectName}" not found for deletion.`);
  }
}

/**
 * Delete rolling stocks by their names if they exist.
 *
 * @param rollingStockNames - The list of rolling stock names to delete.
 * @returns {Promise<void>} - A promise that resolves when the matching rolling stocks are deleted or if none are found.
 */
export async function deleteRollingStocks(rollingStockNames: string[]): Promise<void> {
  const rollingStocks: LightRollingStockWithLiveries[] = await listApiRequest(
    '/api/light_rolling_stock'
  );

  // Find rolling stocks that match the provided names
  const rollingStockIds = rollingStocks
    .filter((r: LightRollingStock) => rollingStockNames.includes(r.name))
    .map((r: LightRollingStock) => r.id);

  if (rollingStockIds.length > 0) {
    // Delete each rolling stock by ID
    await Promise.all(
      rollingStockIds.map((id: number) => deleteApiRequest(`/api/rolling_stock/${id}`))
    );
  } else {
    logger.warn('No matching rolling stocks found for deletion.');
  }
}

/**
 * Delete a study by name if it exists.
 *
 * @param studyName - The name of the study to delete.
 * @returns {Promise<void>} - A promise that resolves when the study is deleted or if not found.
 */
export async function deleteStudy(projectId: number, studyName: string): Promise<void> {
  const study = await getStudy(projectId, studyName);

  if (study) {
    await deleteApiRequest(`/api/projects/${projectId}/studies/${study.id}`);
  } else {
    logger.warn(`Study "${studyName}" not found for deletion.`);
  }
}

/**
 * Delete a scenario by name if it exists.
 *
 * @param scenarioName - The name of the scenario to delete.
 * @returns {Promise<void>} - A promise that resolves when the scenario is deleted or if not found.
 */
export async function deleteScenario(
  projectId: number,
  studyId: number,
  scenarioName: string
): Promise<void> {
  const scenario = await getScenario(projectId, studyId, scenarioName);
  if (scenario?.id) {
    await deleteApiRequest(
      `/api/projects/${projectId}/studies/${studyId}/scenarios/${scenario.id}`
    );
  } else {
    logger.warn(`Scenario "${scenarioName}" not found for deletion.`);
  }
}
