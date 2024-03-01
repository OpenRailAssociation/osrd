import React from 'react';
import type { Position } from 'geojson';
import Origin from './Origin';
import Vias from './Vias';
import Destination from './Destination';

interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
}

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const { zoomToFeaturePoint } = props;

  return (
    <div data-testid="display-itinerary">
      <Origin zoomToFeaturePoint={zoomToFeaturePoint} />
      <Vias zoomToFeaturePoint={zoomToFeaturePoint} />
      <Destination zoomToFeaturePoint={zoomToFeaturePoint} />
    </div>
  );
}
