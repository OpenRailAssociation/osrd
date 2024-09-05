/* eslint-disable import/prefer-default-export */
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { ConfSliceActions } from 'reducers/osrdconf/osrdConfCommon';
import type { PathStep } from 'reducers/osrdconf/types';
import { store } from 'store';
import { addElementAtIndex } from 'utils/array';

export function setPointIti(
  pointType: 'origin' | 'destination' | 'via',
  pathStep: PathStep,
  actions: ConfSliceActions,
  pathProperties?: ManageTrainSchedulePathProperties
) {
  const { updateOrigin, updateDestination, addVia, updatePathSteps, updateFeatureInfoClick } =
    actions;
  const { pathSteps } = store.getState().operationalStudiesConf;

  switch (pointType) {
    case 'origin':
      store.dispatch(updateOrigin(pathStep));
      break;
    case 'destination':
      store.dispatch(updateDestination(pathStep));
      break;
    default:
      if (pathProperties) {
        store.dispatch(addVia({ newVia: pathStep, pathProperties }));
      } else {
        store.dispatch(
          updatePathSteps({
            pathSteps: addElementAtIndex(pathSteps, pathSteps.length - 1, pathStep),
          })
        );
      }
  }
  store.dispatch(updateFeatureInfoClick({ displayPopup: false }));
}
