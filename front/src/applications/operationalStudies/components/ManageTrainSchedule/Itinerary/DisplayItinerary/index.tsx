import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Position } from 'geojson';
import cx from 'classnames';

import { getOrigin, getDestination, getVias } from 'reducers/osrdconf/selectors';

import Pathfinding from 'common/Pathfinding';
import Origin from './Origin';
import Vias from './Vias';
import Destination from './Destination';

interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
  viaModalContent: string;
}

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const { zoomToFeaturePoint, zoomToFeature, viaModalContent } = props;

  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const vias = useSelector(getVias);

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
  zoomToFeaturePoint: PropTypes.func.isRequired,
};
