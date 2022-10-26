import React from 'react';
import { Source, Layer } from 'react-map-gl';

function Panels() {
  const blueprintPrefix = '';
  const filter = [
    'all',
    ['in', 'type_if', 'CHEVRON', 'R', 'TIV D FIXE', 'TIVD C FIX', 'TIVD B FIX', 'Z'],
  ];

  const panelParams = {
    id: 'panelParams',
    type: 'symbol',
    source: 'signalisation',
    'source-layer': 'signalisation_angles',
    minzoom: 10,
    filter,
    layout: {
      'text-font': ['Open Sans Regular'],
      'text-size': 9,
      'icon-image': [
        'case',
        ['==', ['get', 'type_if'], 'CHEVRON'],
        ['concat', blueprintPrefix, 'CHEVRON BAS'],
        ['==', ['get', 'type_if'], 'DESTI'],
        ['concat', blueprintPrefix, 'VIDE'],
        ['==', ['get', 'type_if'], 'DIVERS'],
        ['concat', blueprintPrefix, 'VIDE'],
        ['==', ['get', 'type_if'], 'IDD'],
        ['case', ['==', ['get', 'position'], 'D'], 'IDD GAUCHE', 'IDD DROIT'],
        ['==', ['get', 'type_if'], 'JAL ARRET'],
        ['concat', blueprintPrefix, 'JAL ARR'],
        ['==', ['get', 'type_if'], 'TECS'],
        [
          'case',
          ['==', ['get', 'position'], 'D'],
          ['concat', blueprintPrefix, 'TECS G'],
          ['concat', blueprintPrefix, 'TECS D'],
        ],
        ['==', ['get', 'type_if'], 'TSCS'],
        [
          'case',
          ['==', ['get', 'position'], 'D'],
          ['concat', blueprintPrefix, 'TSCS G'],
          ['concat', blueprintPrefix, 'TSCS D'],
        ],
        ['==', ['get', 'type_if'], 'TIV D FIXE'],
        ['concat', blueprintPrefix, 'TIV D FIXE 60'],
        ['==', ['get', 'type_if'], 'TIV R FIXE'],
        ['concat', blueprintPrefix, 'TIV R FIXE 60'],
        ['==', ['get', 'type_if'], 'TIV D MOB'],
        ['concat', blueprintPrefix, 'TIV D MOB 60'],
        ['==', ['get', 'type_if'], 'TIV R MOB'],
        ['concat', blueprintPrefix, 'TIV R MOB 60'],
        ['==', ['get', 'type_if'], 'TIVD B FIX'],
        ['concat', blueprintPrefix, 'TIVD B FIX 60'],
        ['==', ['get', 'type_if'], 'ARRET VOY'],
        ['concat', blueprintPrefix, 'ARRET VOY TT'],
        ['==', ['get', 'type_if'], 'GARE'],
        'GARE',
        ['==', ['get', 'type_if'], 'SECT'],
        'SECT',
        ['==', ['get', 'type_if'], 'ARRET'],
        'ARRET',
        ['==', ['get', 'type_if'], 'ARRET A'],
        'ARRET A',
        ['==', ['get', 'type_if'], 'IMP'],
        'IMP',
        ['==', ['get', 'type_if'], 'BP EXE'],
        'BP EXE',
        ['==', ['get', 'type_if'], 'BP FIN'],
        'BP FIN',
        ['==', ['get', 'type_if'], 'APPROETSA'],
        'APPROETSA',
        ['==', ['get', 'type_if'], 'P'],
        'P',
        ['==', ['get', 'type_if'], 'PN'],
        'PN',
        ['==', ['get', 'type_if'], 'PN...'],
        'PN...',
        ['concat', blueprintPrefix, ['get', 'type_if']],
      ],
      'icon-size': ['step', ['zoom'], 0.3, 15, 0.4],
      'text-offset': [
        'step',
        ['zoom'],
        ['literal', [1.5, 0]],
        15,
        [
          'case',
          ['==', ['get', 'position'], 'D'],
          ['literal', [4, -1]],
          ['==', ['get', 'position'], 'G'],
          ['literal', [-4, -1]],
          ['literal', [4, 0]],
        ],
      ],
      'icon-offset': [
        'step',
        ['zoom'],
        ['literal', [1.5, 0]],
        15,
        [
          'case',
          ['==', ['get', 'position'], 'D'],
          ['literal', [80, -100]],
          ['==', ['get', 'position'], 'G'],
          ['literal', [-80, -100]],
          ['literal', [0, 0]],
        ],
      ],
      'icon-rotation-alignment': 'map',
      'text-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'text-rotate': ['get', 'angle'],
      'icon-allow-overlap': true,
      'text-allow-overlap': true,
      'icon-ignore-placement': false,
      'text-justify': [
        'case',
        ['==', ['get', 'position'], 'D'],
        'left',
        ['==', ['get', 'position'], 'G'],
        'right',
        'center',
      ],
      'text-anchor': [
        'case',
        ['==', ['get', 'position'], 'D'],
        'left',
        ['==', ['get', 'position'], 'G'],
        'right',
        'center',
      ],
    },
  };

  const mastParams = {
    id: 'mast2',
    type: 'symbol',
    source: 'signalisation',
    'source-layer': 'signalisation_angles',
    minzoom: 15,
    filter,
    layout: {
      'text-font': ['Open Sans Regular'],
      'text-size': 8,
      'text-field': '',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'icon-image': [
        'case',
        ['==', ['get', 'position'], 'D'],
        'MATD',
        ['==', ['get', 'position'], 'G'],
        'MATG',
        '',
      ],
      'icon-size': 1,
      'icon-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  };

  return (
    <Source
      id="panel"
      type="vector"
      url="https://osm.osrd.fr/data/signalisation.json"
      source-layer="signalisation_angles"
    >
      <Layer {...mastParams} />
      <Layer {...panelParams} />
    </Source>
  );
}

export default Panels;
