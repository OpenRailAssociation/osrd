import { store } from 'Store';
import { updateFeatureInfoClick } from 'reducers/map';
import {
  updateOrigin,
  updateDestination,
  updateVias,
  updateFeatureInfoClickOSRD,
  updateShouldRunPathfinding,
} from 'reducers/osrdconf';
import { PointOnMap } from 'applications/operationalStudies/consts';

export default function setPointIti(pointType: string, data: PointOnMap) {
  store.dispatch(updateShouldRunPathfinding(true));
  switch (pointType) {
    case 'start':
      store.dispatch(updateOrigin(data));
      break;
    case 'end':
      store.dispatch(updateDestination(data));
      break;
    default:
      store.dispatch(updateVias(data));
  }
  store.dispatch(updateFeatureInfoClickOSRD({ displayPopup: false }));
  store.dispatch(updateFeatureInfoClick(undefined));
}
