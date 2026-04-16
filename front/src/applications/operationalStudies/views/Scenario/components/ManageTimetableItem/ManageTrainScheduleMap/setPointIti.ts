import type { MapPathProperties } from 'applications/operationalStudies/types';
import { insertViaFromMap } from 'reducers/osrdconf/helpers';
import type { PathStep } from 'reducers/osrdconf/types';
import { store } from 'store';
import { addElementAtIndex, replaceElementAtIndex } from 'utils/array';

export function setPointIti(
  pointType: 'origin' | 'destination' | 'via',
  pathStep: PathStep,
  launchPathfinding: (newPathSteps: (PathStep | null)[]) => void,
  resetFeatureInfoClick: () => void,
  pathProperties?: MapPathProperties
) {
  const { pathSteps } = store.getState().operationalStudiesConf;

  let newPathSteps: (PathStep | null)[];

  switch (pointType) {
    case 'origin':
      newPathSteps = replaceElementAtIndex(pathSteps, 0, pathStep);
      break;
    case 'destination':
      if (pathSteps.length === 1) {
        newPathSteps = addElementAtIndex(pathSteps, pathSteps.length, pathStep);
      } else {
        newPathSteps = replaceElementAtIndex(pathSteps, pathSteps.length - 1, pathStep);
      }
      break;
    default:
      if (pathSteps.length === 1) {
        newPathSteps = addElementAtIndex(pathSteps, pathSteps.length, pathStep);
      } else if (pathProperties) {
        newPathSteps = insertViaFromMap(pathSteps, pathStep, pathProperties);
      } else {
        newPathSteps = addElementAtIndex(pathSteps, pathSteps.length - 1, pathStep);
      }
  }
  resetFeatureInfoClick();
  launchPathfinding(newPathSteps);
}
