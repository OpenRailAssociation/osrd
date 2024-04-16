import type { PointOnMap } from 'applications/operationalStudies/consts';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { ConfSliceActions } from 'reducers/osrdconf/osrdConfCommon';
import type { PathStep } from 'reducers/osrdconf/types';
import { store } from 'store';

export function setPointIti(pointType: string, data: PointOnMap, actions: ConfSliceActions) {
  const { updateOrigin, updateDestination, addVias, updateFeatureInfoClick } = actions;
  const point: PointOnMap = {
    ...data,
    location: { track_section: data.id, geo_coordinates: data.coordinates },
  };

  switch (pointType) {
    case 'start':
      store.dispatch(updateOrigin(point));
      break;
    case 'end':
      store.dispatch(updateDestination(point));
      break;
    default:
      store.dispatch(addVias(point));
  }
  store.dispatch(updateFeatureInfoClick({ displayPopup: false }));
}

export function setPointItiV2(
  pointType: 'origin' | 'destination' | 'via',
  pathStep: PathStep,
  actions: ConfSliceActions,
  pathProperties?: ManageTrainSchedulePathProperties
) {
  const { updateOriginV2, updateDestinationV2, addViaV2, updateFeatureInfoClick } = actions;

  switch (pointType) {
    case 'origin':
      store.dispatch(updateOriginV2(pathStep));
      break;
    case 'destination':
      store.dispatch(updateDestinationV2(pathStep));
      break;
    default:
      if (pathProperties) {
        store.dispatch(addViaV2({ newVia: pathStep, pathProperties }));
      } else {
        console.error('No pathProperties');
      }
  }
  store.dispatch(updateFeatureInfoClick({ displayPopup: false }));
}
