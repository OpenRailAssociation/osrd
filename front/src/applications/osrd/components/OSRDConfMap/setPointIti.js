import { store } from 'Store';
import { updateFeatureInfoClick } from 'reducers/map';
import {
  updateOrigin, updateDestination, updateVias, updateFeatureInfoClickOSRD,
} from 'reducers/osrdconf';

export default function setPointIti(point, data) {
  switch (point) {
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
  store.dispatch(updateFeatureInfoClick(undefined, undefined));
}
