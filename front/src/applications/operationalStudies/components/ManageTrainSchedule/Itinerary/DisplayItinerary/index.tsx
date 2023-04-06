import React, { ComponentType } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import cx from 'classnames';

import { getOrigin, getDestination, getVias } from 'reducers/osrdconf/selectors';

import Pathfinding from 'common/Pathfinding';
import { PointOnMap } from 'applications/operationalStudies/consts';
import { noop } from 'lodash';
import { Dispatch } from 'redux';
import Origin from './Origin';
import Vias from './Vias';
import Destination from './Destination';

interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
  viaModalContent: JSX.Element;
  origin?: PointOnMap | undefined;
  destination?: PointOnMap | undefined;
  dispatch?: Dispatch;
  vias?: PointOnMap[];
}

export function withOSRDData<T>(Component: ComponentType<T>) {
  return function composedDisplayItinerary(hocProps: T) {
    const origin = useSelector(getOrigin);
    const destination = useSelector(getDestination);
    const vias = useSelector(getVias);
    const dispatch = useDispatch();
    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        origin={origin}
        destination={destination}
        vias={vias}
      />
    );
  };
}

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const {
    zoomToFeaturePoint,
    zoomToFeature,
    viaModalContent,
    origin,
    destination,
    vias,
    dispatch = noop,
  } = props;

  return (
    <div
      className={cx({
        'osrd-config-anchor': !origin && !destination && vias && vias?.length < 1,
      })}
    >
      <Origin data-testid="itinerary-origin" zoomToFeaturePoint={zoomToFeaturePoint} />
      <Vias
        data-testid="itinerary-vias"
        zoomToFeaturePoint={zoomToFeaturePoint}
        viaModalContent={viaModalContent}
      />
      <Destination data-testid="itinerary-destination" zoomToFeaturePoint={zoomToFeaturePoint} />

      <Pathfinding zoomToFeature={zoomToFeature} />
    </div>
  );
}
