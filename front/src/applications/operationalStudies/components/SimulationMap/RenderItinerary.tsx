import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl';
import { Feature, LineString } from 'geojson';

import { RootState } from 'reducers';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface RenderItineraryProps {
  geojsonPath: Feature<LineString>;
  layerOrder: number;
}

export default function RenderItinerary(props: RenderItineraryProps) {
  const { geojsonPath, layerOrder } = props;
  const { selectedTrain, allowancesSettings } = useSelector(
    (state: RootState) => state.osrdsimulation
  );
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  return (
    <Source type="geojson" data={geojsonPath}>
      <OrderedLayer
        id="geojsonPath"
        type="line"
        paint={{
          'line-width': 3,
          'line-color':
            allowancesSettings?.[trainID] && allowancesSettings[trainID].ecoBlocks
              ? '#82be00'
              : '#303383',
        }}
        layerOrder={layerOrder}
      />
    </Source>
  );
}
