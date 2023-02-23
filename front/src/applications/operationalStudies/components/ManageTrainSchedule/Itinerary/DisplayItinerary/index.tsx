import React, { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { Position } from 'geojson';
import cx from 'classnames';

import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import Pathfinding from 'common/Pathfinding';
import { getStdcmMode, getMode, getOrigin, getDestination } from 'reducers/osrdconf/selectors';
import Origin from './Origin';
import Vias from './Vias';
import Destination from './Destination';

// Interfaces
import { PointOnMap } from 'applications/operationalStudies/consts';

interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
  viaModalContent: string;
  origin: PointOnMap;
  destination: PointOnMap;
  vias: PointOnMap[];
}

// We use this HOC to pass only props needed by DisplayIntinerary subComponents(Vias, Origin, Destination, Pathfinding). Us a composition from the container
// Props for Display Intinerary itself are provided by Itinerary, even if it is formaly isolated.

export function withOSRDSimulationData<T>(Component: ComponentType<T>) {
  return (hocProps: DisplayItineraryProps) => {
    const origin = useSelector(getOrigin);
    const destination = useSelector(getDestination);

    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

    return <Component {...(hocProps as T)} origin={origin} destination={destination} />;
  };
}

/**
 *
 *   getOriginDate,
  getOriginTime,
  getOriginSpeed,
  getOriginLinkedBounds,
  getOriginUpperBoundDate,
  getOriginUpperBoundTime,
    const originDate = useSelector(getOriginDate);
    const originTime = useSelector(getOriginTime);
    const originSpeed = useSelector(getOriginSpeed);
    const originLinkedBounds = useSelector(getOriginLinkedBounds);
    const originUpperBoundDate = useSelector(getOriginUpperBoundDate);
    const originUpperBoundTime = useSelector(getOriginUpperBoundTime);
 */

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const { zoomToFeaturePoint, zoomToFeature, viaModalContent, origin, destination, vias } = props;

  return (
    <div
      className={cx({
        'osrd-config-anchor': !origin && !destination && vias.length < 1,
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

DisplayItinerary.propTypes = {
  zoomToFeaturePoint: PropTypes.func,
  zoomToFeature: PropTypes.func,
  viaModalContent: PropTypes.string,
  origin: PropTypes.object,
  destination: PropTypes.object,
  vias: PropTypes.array,
};

DisplayItinerary.defaultProps = {
  zoomToFeaturePoint: () => {},
  zoomToFeature: () => {},
  viaModalContent: '',
  origin: {},
  destination: {},
  vias: [],
};
