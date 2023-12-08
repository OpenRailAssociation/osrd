import React from 'react';
import { Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getGeojson, getOrigin, getDestination } from 'reducers/osrdconf/selectors';
import { GeoJSONFeature } from 'maplibre-gl';

interface ItineraryProps {
  layerOrder: number;
}

export default function Itinerary(props: ItineraryProps) {
  const { layerOrder } = props;
  const geojson = useSelector(getGeojson);
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  if (geojson && geojson.geographic && origin !== undefined && destination !== undefined) {
    return (
      // TODO: clarify geojson[mapTrackSources] type
      <Source type="geojson" data={geojson.geographic as unknown as GeoJSONFeature}>
        <OrderedLayer
          type="line"
          paint={{
            'line-width': 5,
            'line-color': 'rgba(210, 225, 0, 0.75)',
          }}
          layerOrder={layerOrder}
        />
      </Source>
    );
  }
  return null;
}
