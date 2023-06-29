/* eslint-disable no-console */
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';

import maplibregl, { MapGeoJSONFeature } from 'maplibre-gl';
import { Feature, FeatureCollection } from 'geojson';
import ReactMapGL, { Source, MapRef, MapboxGeoJSONFeature } from 'react-map-gl';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { featureCollection } from '@turf/helpers';
import { map, sum, uniqBy } from 'lodash';

import { LayerType } from '../../../applications/editor/tools/types';
import osmBlankStyle from '../Layers/osmBlankStyle';
import GeoJSONs from '../Layers/GeoJSONs';
import colors from '../Consts/colors';
import { getMap } from '../../../reducers/map/selectors';
import { OSM_URL } from '../const';
import { genLayers } from '../Layers/OSM';

function simplifyFeature(feature: MapboxGeoJSONFeature): Feature {
  const f = feature as unknown as MapGeoJSONFeature;
  return {
    type: 'Feature',
    id: f.id,
    properties: { ...f.properties, sourceLayer: f.sourceLayer },
    // eslint-disable-next-line no-underscore-dangle
    geometry: f.geometry || f._geometry,
  };
}

const TIME_LABEL = 'Loading OSRD and OSM data around warped path';

const DataLoader: FC<{
  bbox: BBox2d;
  getGeoJSONs: (
    osrdData: Partial<Record<LayerType, FeatureCollection>>,
    osmData: Record<string, FeatureCollection>
  ) => void;
  layers: Set<LayerType>;
}> = ({ bbox, getGeoJSONs, layers }) => {
  const { mapStyle, layersSettings } = useSelector(getMap);
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [state, setState] = useState<'idle' | 'render' | 'loaded'>('idle');
  const osmLayers = useMemo(() => genLayers(mapStyle), [mapStyle]);

  useEffect(() => {
    if (!mapRef) return;

    mapRef.fitBounds(bbox, { animate: false });
    setTimeout(() => {
      console.time(TIME_LABEL);
      setState('render');
    }, 0);
  }, [mapRef, bbox]);

  useEffect(() => {
    if (state === 'render') {
      const m = mapRef as MapRef;

      const querySources = () => {
        // Retrieve OSRD data:
        let osrdFeaturesCount = 0;
        const osrdData: Partial<Record<LayerType, FeatureCollection>> = {};
        layers.forEach((layer) => {
          osrdData[layer] = featureCollection(
            uniqBy(
              m
                .querySourceFeatures(`editor/geo/${layer}`, { sourceLayer: layer })
                .map(simplifyFeature),
              (f) => f.id
            )
          );
          osrdFeaturesCount += osrdData[layer]?.features.length || 0;
        });

        // Retrieve OSM data:
        // (we have to force cast, because in our weird setup, osmSource is
        // typed as if it was from mapbox when it actually comes from maplibre)
        const osmSource = m.getSource('osm') as unknown as { vectorLayerIds: string[] };
        let incrementalID = 1;
        const osmData: Record<string, FeatureCollection> = osmSource.vectorLayerIds.reduce(
          (iter, sourceLayer) => ({
            ...iter,
            [sourceLayer]: featureCollection(
              uniqBy(
                m.querySourceFeatures('osm', { sourceLayer }).map(simplifyFeature),
                // eslint-disable-next-line no-plusplus
                (f) => (f.id ? `osm-${f.id}` : `generated-${++incrementalID}`) // only deduplicate features with IDs
              )
            ),
          }),
          {}
        );
        const osmFeaturesCount = sum(map(osmData, (collection) => collection.features.length));

        console.timeEnd(TIME_LABEL);
        console.log('  - OSRD features: ', osrdFeaturesCount);
        console.log('  - OSM features: ', osmFeaturesCount);

        // Finalize:
        getGeoJSONs(osrdData, osmData);
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
            height: 1200,
            width: 1200,
          }}
        >
          <ReactMapGL
            ref={setMapRef}
            mapLib={maplibregl}
            mapStyle={osmBlankStyle}
            style={{ width: '100%', height: '100%' }}
          >
            {state === 'render' && (
              <>
                <Source id="osm" type="vector" url={OSM_URL}>
                  {osmLayers}
                </Source>
                <GeoJSONs
                  colors={colors[mapStyle]}
                  layersSettings={layersSettings}
                  isEmphasized={false}
                  layers={layers}
                  renderAll
                />
              </>
            )}
          </ReactMapGL>
        </div>,
        document.body
      )
    : null;
};

export default DataLoader;
