import React from 'react';
import { Position } from 'geojson';

import Origin from './Origin';
import Vias from './Vias';
import Destination from './Destination';

interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
  viaModalContent: JSX.Element;
}

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const { zoomToFeaturePoint, viaModalContent } = props;

  return (
    <div data-testid="display-itinerary">
      <Origin zoomToFeaturePoint={zoomToFeaturePoint} />
      <Vias zoomToFeaturePoint={zoomToFeaturePoint} viaModalContent={viaModalContent} />
      <Destination zoomToFeaturePoint={zoomToFeaturePoint} />
    </div>
  );
}
