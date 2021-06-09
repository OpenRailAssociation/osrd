import React from 'react';
import { Source, Layer } from 'react-map-gl';
import { useSelector } from 'react-redux';
import { MAP_URL } from 'common/Map/const';

const SignalBox = () => {
  const { mapTrackSources } = useSelector((state) => state.map);
  const geomType = mapTrackSources === 'schematic' ? 'sch' : 'geo';
  const layerdef = {
    id: 'map_midi_poste_layer',
    type: 'symbol',
    minzoom: 8,
    'source-layer': 'map_midi_circuitdevoie',
    layout: {
      'text-field': '{RA_libelle_gare}',
      'text-font': [
        'Roboto Bold',
      ],
      'text-size': 14,
      'text-offset': [2, 0],
      'text-anchor': 'center',
      'text-allow-overlap': false,
      visibility: 'visible',
    },
    paint: {
      'text-color': '#555',
      'text-halo-width': 2,
      'text-halo-color': 'rgba(255,255,255,0.75)',
      'text-halo-blur': 1,
    },
  };

  return (
    <Source
      id="map_midi_poste"
      type="vector"
      url={`${MAP_URL}/chartis/layer/map_midi_circuitdevoie/mvt/${geomType}/`}
    >
      <Layer {...layerdef} id="chartis/signal-box" />
    </Source>
  );
};

export default SignalBox;
