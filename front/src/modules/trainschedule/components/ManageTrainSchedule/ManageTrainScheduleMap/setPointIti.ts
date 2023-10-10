import { store } from 'Store';
import { updateFeatureInfoClick } from 'reducers/map';
import {
  updateOrigin,
  updateDestination,
  updateVias,
  updateFeatureInfoClickOSRD,
} from 'reducers/osrdconf';
import { PointOnMap } from 'applications/operationalStudies/consts';

export default function setPointIti(pointType: string, data: PointOnMap) {
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
      store.dispatch(updateVias(point));
  }
  store.dispatch(updateFeatureInfoClickOSRD({ displayPopup: false }));
  store.dispatch(updateFeatureInfoClick(undefined));
}
