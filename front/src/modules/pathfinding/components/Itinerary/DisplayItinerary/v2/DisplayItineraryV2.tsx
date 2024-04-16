import React from 'react';

import type { Position } from 'geojson';

import DestinationV2 from './DestinationV2';
import OriginV2 from './OriginV2';
import ViasV2 from './ViasV2';

type DisplayItineraryProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const DisplayItineraryV2 = ({ zoomToFeaturePoint }: DisplayItineraryProps) => (
  <div data-testid="display-itinerary">
    <OriginV2 zoomToFeaturePoint={zoomToFeaturePoint} />
    <ViasV2 zoomToFeaturePoint={zoomToFeaturePoint} />
    <DestinationV2 zoomToFeaturePoint={zoomToFeaturePoint} />
  </div>
);

export default DisplayItineraryV2;
