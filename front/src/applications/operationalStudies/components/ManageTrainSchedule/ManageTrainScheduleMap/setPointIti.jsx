import { store } from 'Store';
import { updateFeatureInfoClick } from 'reducers/map';
import { MODES } from 'applications/operationalStudies/consts';
import {
  updateOrigin,
  updateDestination,
  updateVias,
  updateFeatureInfoClickOSRD,
} from 'reducers/osrdconf';

import {
  updateOrigin as updateOriginStdcm,
  updateDestination as updateDestinationStdcm,
  updateVias as updateViasStdcm,
} from 'reducers/osrdStdcmConf';

export default function setPointIti(point, data, mode = MODES.simulation) {
  switch (point) {
    case 'start':
      store.dispatch(mode === MODES.stdcm ? updateOriginStdcm(data) : updateOrigin(data));
      break;
    case 'end':
      store.dispatch(mode === MODES.stdcm ? updateDestinationStdcm(data) : updateDestination(data));
      break;
    default:
      store.dispatch(mode === MODES.stdcm ? updateViasStdcm(data) : updateVias(data));
  }
  store.dispatch(updateFeatureInfoClickOSRD({ displayPopup: false }));
  store.dispatch(updateFeatureInfoClick(undefined, undefined));
}
