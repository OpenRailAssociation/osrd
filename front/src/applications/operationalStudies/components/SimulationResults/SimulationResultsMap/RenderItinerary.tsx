import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl';
import { Feature, LineString } from 'geojson';

import { RootState } from 'reducers';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface RenderItineraryProps {
  geojsonPath: Feature<LineString>;
  layerOrder: number;
  isSearchLine?: boolean;
}

export default function RenderItinerary(props: RenderItineraryProps) {
  const { geojsonPath, layerOrder, isSearchLine } = props;
  const { selectedTrain, allowancesSettings } = useSelector(
    (state: RootState) => state.osrdsimulation
  );
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  const paint = isSearchLine
    ? {
        'line-width': 3,
        'line-color':
          allowancesSettings?.[trainID] && allowancesSettings[trainID].ecoBlocks
            ? '#82be00'
            : '#303383',
      }
    : {
        'line-width': 3,
        'line-color': '#82be00',
      };
  return (
    <Source type="geojson" data={geojsonPath}>
      <OrderedLayer id="geojsonPath" type="line" paint={paint} layerOrder={layerOrder} />
    </Source>
  );
}
