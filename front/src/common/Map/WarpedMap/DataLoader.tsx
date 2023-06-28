import React, { FC, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';

import { GeoJSON } from 'geojson';
import maplibregl from 'maplibre-gl';
import ReactMapGL, { MapRef } from 'react-map-gl';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';

import { LayerType } from '../../../applications/editor/tools/types';
import osmBlankStyle from '../Layers/osmBlankStyle';
import GeoJSONs from '../Layers/GeoJSONs';
import colors from '../Consts/colors';
import { getMap } from '../../../reducers/map/selectors';

const DataLoader: FC<{
  bbox: BBox2d;
  getGeoJSONs: (data: Partial<Record<LayerType, GeoJSON[]>>) => void;
  layers: Set<LayerType>;
}> = ({ bbox, getGeoJSONs, layers }) => {
  const { mapStyle, layersSettings } = useSelector(getMap);
  const [map, setMap] = useState<MapRef | null>(null);
  const [state, setState] = useState<'idle' | 'render' | 'loaded'>('idle');

  useEffect(() => {
    if (!map) return;

    map.fitBounds(bbox, { animate: false });
    setTimeout(() => {
      setState('render');
    }, 0);
  }, [map, bbox]);

  useEffect(() => {
    if (state === 'render') {
      const m = map as MapRef;

      const querySources = () => {
        const data: Partial<Record<LayerType, GeoJSON[]>> = {};
        layers.forEach((layer) => {
          data[layer] = m.querySourceFeatures(`editor/geo/${layer}`, { sourceLayer: layer });
        });
        getGeoJSONs(data);
        setState('loaded');
      };

      m.on('idle', querySources);

      return () => {
        m.off('idle', querySources);
      };
    }

    return undefined;
  }, [state]);

  return state !== 'loaded'
    ? createPortal(
        <div
          className="position-absolute"
          style={{
            bottom: '110%',
            height: 500,
            width: 500,
          }}
        >
          <ReactMapGL
            ref={setMap}
            mapLib={maplibregl}
            mapStyle={osmBlankStyle}
            style={{ width: '100%', height: '100%' }}
          >
            {state === 'render' && (
              <GeoJSONs
                colors={colors[mapStyle]}
                layersSettings={layersSettings}
                isEmphasized={false}
                layers={layers}
                renderAll
              />
            )}
          </ReactMapGL>
        </div>,
        document.body
      )
    : null;
};

export default DataLoader;
