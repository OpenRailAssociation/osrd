import React from 'react';
import { Source } from 'react-map-gl';
import { useSelector } from 'react-redux';

import { RootState } from 'reducers';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { ValueOf } from 'utils/types';
import { MODES } from 'applications/operationalStudies/consts';

interface RenderItineraryProps {
  layerOrder: number;
  mode: ValueOf<typeof MODES>;
}

export default function RenderItinerary(props: RenderItineraryProps) {
  const { layerOrder, mode } = props;
  const { geojson, origin, destination } = useSelector((state: RootState) =>
    mode === MODES.stdcm ? state.osrdStdcmConf : state.osrdconf
  );
  const { mapTrackSources } = useSelector((state: RootState) =>
    MODES.stdcm ? state.mapStdcm : state.map
  );
  if (geojson && geojson[mapTrackSources] && origin !== undefined && destination !== undefined) {
    return (
      <Source type="geojson" data={geojson[mapTrackSources] as any}>
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
