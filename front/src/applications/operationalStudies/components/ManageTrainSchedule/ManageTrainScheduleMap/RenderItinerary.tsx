import React from 'react';
import { Source } from 'react-map-gl';
import { useSelector } from 'react-redux';

import { RootState } from 'reducers';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface RenderItineraryProps {
  layerOrder: number;
}

export default function RenderItinerary(props: RenderItineraryProps) {
  const { layerOrder } = props;
  const { geojson, origin, destination } = useSelector((state: RootState) => state.osrdconf);
  const { mapTrackSources } = useSelector((state: RootState) => state.map);
  if (
    geojson &&
    geojson[mapTrackSources as any] &&
    origin !== undefined &&
    destination !== undefined
  ) {
    return (
      <Source type="geojson" data={geojson[mapTrackSources as any]}>
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
