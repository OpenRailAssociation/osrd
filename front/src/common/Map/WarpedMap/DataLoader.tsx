/* eslint-disable no-console */
import { useEffect, useMemo, useState } from 'react';

import { featureCollection } from '@turf/helpers';
import type { FeatureCollection } from 'geojson';
import { uniqBy } from 'lodash';
import { createPortal } from 'react-dom';
import type { LayerProps, MapRef } from 'react-map-gl/maplibre';
import ReactMapGL, { Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import type { Layer } from 'applications/editor/consts';
import mapStyleJson from 'assets/mapstyles/OSMStyle.json';
import { OSM_URL } from 'common/Map/const';
import colors from 'common/Map/Consts/colors';
import { useMapBlankStyle } from 'common/Map/Layers/blankStyle';
import GeoJSONs from 'common/Map/Layers/InfraObjectLayers/GeoJSONs';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { simplifyFeature, type BBox2d } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import { getMap } from 'reducers/map/selectors';

const TIME_LABEL = 'Loading OSRD and OSM data around warped path';

const OSM_LAYERS = new Set(['building', 'water', 'water_name', 'waterway', 'poi']);

/**
 * This component handles loading entities from MapLibre vector servers, and retrieving them as GeoJSONs from the
 * MapLibre `querySourceFeatures` method.
 * It's quite dirty (it has to mount a map in the DOM, but somewhere it won't be visible), but necessary until we get
 * proper APIs for both OSRD data and OSM data.
 *
 * It is designed as a component instead of a hook to simplify mounting/unmounting the temporary invisible map.
 */

interface DataLoaderProps {
  bbox: BBox2d;
  getGeoJSONs: (
    osrdData: Partial<Record<Layer, FeatureCollection>>,
    osmData: Record<string, FeatureCollection>
  ) => void;
  layers: Set<Layer>;
}

const DataLoader = ({ bbox, getGeoJSONs, layers }: DataLoaderProps) => {
  const mapBlankStyle = useMapBlankStyle();
  const { mapStyle, layersSettings } = useSelector(getMap);
  const infraID = useInfraID();
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [state, setState] = useState<'idle' | 'render' | 'loaded'>('idle');
  const osmLayers = useMemo(() => {
    const osmStyle = (mapStyleJson as LayerProps[]).filter(
      (layer) => layer.id && OSM_LAYERS.has(layer.id)
    );
    return osmStyle.map((layer) => ({
      ...layer,
      id: `osm/${layer.id}`,
    }));
  }, []);

  useEffect(() => {
    if (!mapRef) return;

    mapRef.fitBounds(bbox, { animate: false });
    setTimeout(() => {
      console.time(TIME_LABEL);
      setState('render');
    }, 0);
  }, [mapRef, bbox]);

  useEffect(() => {
    if (state === 'render' && mapRef) {
      const m = mapRef;

      const querySources = () => {
        // Retrieve OSRD data:
        const osrdData: Partial<Record<Layer, FeatureCollection>> = {};
        layers.forEach((layer) => {
          osrdData[layer] = featureCollection(
            uniqBy(
              m
                .querySourceFeatures(`editor/geo/${layer}`, { sourceLayer: layer })
                .map(simplifyFeature),
              (f) => f.id
            )
          );
        });

        // Retrieve OSM data:
        // (we have to force cast, because in our weird setup, osmSource is
        // typed as if it was from mapbox when it actually comes from maplibre)
        const osmSource = m.getSource('osm') as unknown as { vectorLayerIds: string[] };
        let incrementalID = 1;
        const osmData: Record<string, FeatureCollection> = osmSource.vectorLayerIds.reduce(
          (iter, sourceLayer) =>
            OSM_LAYERS.has(sourceLayer)
              ? {
                  ...iter,
                  [sourceLayer]: featureCollection(
                    uniqBy(
                      m.querySourceFeatures('osm', { sourceLayer }).map(simplifyFeature),
                      // eslint-disable-next-line no-plusplus
                      (f) => (f.id ? `osm-${f.id}` : `generated-${++incrementalID}`) // only deduplicate features with IDs
                    )
                  ),
                }
              : iter,
          {}
        );

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
  }, [state, mapRef]);

  if (state === 'loaded') return null;
  return createPortal(
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
        mapStyle={mapBlankStyle}
        style={{ width: '100%', height: '100%' }}
      >
        {state === 'render' && (
          <>
            <Source id="osm" type="vector" url={OSM_URL}>
              {osmLayers.map((layer) => (
                <OrderedLayer key={layer.id} {...layer} />
              ))}
            </Source>
            <GeoJSONs
              colors={colors[mapStyle]}
              layersSettings={layersSettings}
              isEmphasized={false}
              layers={layers}
              renderAll
              infraID={infraID}
            />
          </>
        )}
      </ReactMapGL>
    </div>,
    document.body
  );
};

export default DataLoader;
