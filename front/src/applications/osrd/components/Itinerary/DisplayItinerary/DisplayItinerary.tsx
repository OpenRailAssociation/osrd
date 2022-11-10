import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Position } from 'geojson';
import cx from 'classnames';

import { getOrigin, getDestination, getVias } from 'reducers/osrdconf/selectors';

import Origin from './Origin';
import Vias from './Vias';
import Destination from './Destination';

interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
}

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const { zoomToFeaturePoint } = props;

  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const vias = useSelector(getVias);

  return (
    <div
      className={cx({
        'osrd-config-anchor': !origin && !destination && vias.length < 1,
      })}
    >
      <Origin zoomToFeaturePoint={zoomToFeaturePoint} />
      <Vias zoomToFeaturePoint={zoomToFeaturePoint} />
      <Destination zoomToFeaturePoint={zoomToFeaturePoint} />
    </div>
  );
}

DisplayItinerary.propTypes = {
  zoomToFeaturePoint: PropTypes.func.isRequired,
};
