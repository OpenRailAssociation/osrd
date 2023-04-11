import React from 'react';
import { Position } from 'geojson';

import Pathfinding from 'common/Pathfinding';
import Origin from './Origin';
import Vias from './Vias';
import Destination from './Destination';

interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
  viaModalContent: JSX.Element;
}

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const { zoomToFeaturePoint, zoomToFeature, viaModalContent } = props;

  return (
    <>
      <Origin data-testid="itinerary-origin" zoomToFeaturePoint={zoomToFeaturePoint} />
      <Vias
        data-testid="itinerary-vias"
        zoomToFeaturePoint={zoomToFeaturePoint}
        viaModalContent={viaModalContent}
      />
      <Destination data-testid="itinerary-destination" zoomToFeaturePoint={zoomToFeaturePoint} />

      <Pathfinding zoomToFeature={zoomToFeature} />
    </>
  );
}
