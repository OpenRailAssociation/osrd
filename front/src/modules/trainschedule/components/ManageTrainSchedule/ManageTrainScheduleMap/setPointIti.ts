import type { PointOnMap } from 'applications/operationalStudies/consts';
import type { ConfSliceActions } from 'reducers/osrdconf/osrdConfCommon';
import { store } from 'store';

export default function setPointIti(
  pointType: string,
  data: PointOnMap,
  actions: ConfSliceActions
) {
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
