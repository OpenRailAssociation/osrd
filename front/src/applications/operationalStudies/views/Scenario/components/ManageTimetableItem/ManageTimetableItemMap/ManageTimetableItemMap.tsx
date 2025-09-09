import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import bbox from '@turf/bbox';
import type { Feature, Point } from 'geojson';
import { compact } from 'lodash';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';

import type { MapPathProperties } from 'applications/operationalStudies/types';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { SnappedMarker } from 'common/Map/Layers';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { SuggestedOP } from 'modules/timetableItem/types';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import AddPathStepPopup from './AddPathStepPopup';
import ItineraryLayer from './ItineraryLayer';
import ItineraryMarkers, { type MarkerInformation } from './ItineraryMarkers';
import type { FeatureInfoClick } from '../types';

const OPERATIONAL_POINT_LAYERS = [
  'chartis/osrd_operational_point/geo',
  'chartis/osrd_operational_point_name/geo',
];

type MapProps = {
  pathProperties?: MapPathProperties;
  simulationPathSteps: MarkerInformation[];
  pathStepsAndSuggestedOPs?: SuggestedOP[];
};

const ManageTimetableItemMap = ({
  pathProperties,
  simulationPathSteps,
  pathStepsAndSuggestedOPs,
  children,
}: PropsWithChildren<MapProps>) => {
  const dispatch = useAppDispatch();

  const infraID = useInfraID();
  const mapSettings = useMapSettings();
  const { viewport, layersSettings } = mapSettings;
  const { removeMapSearchMarker, updateViewport } = useMapSettingsActions();

  const mapRef = useRef<MapRef | null>(null);
  const mapContainer = useMemo(() => mapRef.current?.getContainer(), [mapRef.current]);

  const pathGeometry = useMemo(() => pathProperties?.geometry, [pathProperties]);

  const [hoveredOperationalPointId, setHoveredOperationalPointId] = useState<string>();
  const [snappedPoint, setSnappedPoint] = useState<Feature<Point> | undefined>();

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value));
    },
    [dispatch]
  );

  const [featureInfoClick, setFeatureInfoClick] = useState<FeatureInfoClick>();

  const resetFeatureInfoClick = useCallback(() => {
    setFeatureInfoClick(undefined);
  }, []);

  const closeFeatureInfoClickPopup = useCallback(() => {
    if (featureInfoClick) {
      setFeatureInfoClick(undefined);
    }
  }, [featureInfoClick]);

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: 0,
      pitch: 0,
    });
  };

  const onFeatureClick = (e: MapLayerMouseEvent) => {
    const result = getMapMouseEventNearestFeature(e, {
      layersId: [
        'chartis/tracks-geo/main',
        ...(layersSettings.operational_points ? OPERATIONAL_POINT_LAYERS : []),
      ],
    });
    if (result && result.feature.properties && result.feature.properties.id) {
      setFeatureInfoClick({
        feature: result.feature,
        coordinates: result.nearest,
        isOperationalPoint: result.feature.sourceLayer === 'operational_points',
      });
    } else {
      setFeatureInfoClick(undefined);
    }
    dispatch(removeMapSearchMarker());
  };

  const onMoveGetFeature = (e: MapLayerMouseEvent) => {
    const result = getMapMouseEventNearestFeature(e, {
      layersId: [
        'chartis/tracks-geo/main',
        ...(layersSettings.operational_points ? OPERATIONAL_POINT_LAYERS : []),
      ],
    });
    if (
      result &&
      result.feature.properties &&
      result.feature.properties.id &&
      (result.feature.geometry.type === 'LineString' || result.feature.geometry.type === 'Point')
    ) {
      if (result.feature.geometry.type === 'Point') {
        setHoveredOperationalPointId(result.feature.properties.id);
      }

      setSnappedPoint({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: result.nearest,
        },
        properties: {
          distance: result.distance,
        },
      });
    } else {
      setHoveredOperationalPointId(undefined);
      setSnappedPoint(undefined);
    }
  };

  const interactiveLayerIds = useMemo(() => {
    const result: Array<string> = [];
    result.push('chartis/tracks-geo/main');
    if (layersSettings.operational_points) {
      result.push('chartis/osrd_operational_point/geo');
    }
    if (layersSettings.tvds) {
      result.push('chartis/osrd_tvd_section/geo');
    }
    return result;
  }, [layersSettings]);

  useEffect(() => {
    const points = pathGeometry ?? {
      coordinates: compact(simulationPathSteps.map((step) => step.coordinates)),
      type: 'LineString',
    };
    if (points.coordinates.length > 2) {
      const newViewport = computeBBoxViewport(bbox(points), viewport, {
        width: mapContainer?.clientWidth,
        height: mapContainer?.clientHeight,
        padding: 60,
      });
      dispatch(updateViewport(newViewport));
    }
  }, [pathGeometry, simulationPathSteps, mapContainer]);

  return (
    <>
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        closeFeatureInfoClickPopup={closeFeatureInfoClickPopup}
        bearing={viewport.bearing}
        withMapKeyButton
        viewPort={viewport}
        isNewButtons
        mapSettings={mapSettings}
      />
      <BaseMap
        mapId="map-container"
        mapRef={mapRef}
        cursor="pointer"
        hoveredOperationalPointId={hoveredOperationalPointId}
        infraId={infraID}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onFeatureClick}
        onMouseMove={onMoveGetFeature}
        mapSettings={mapSettings}
        updatePartialViewPort={updateViewportChange}
      >
        {featureInfoClick && (
          <AddPathStepPopup
            infraId={infraID}
            pathProperties={pathProperties}
            featureInfoClick={featureInfoClick}
            resetFeatureInfoClick={resetFeatureInfoClick}
          />
        )}

        <ItineraryLayer
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]}
          geometry={pathGeometry}
        />
        {infraID && (
          <ItineraryMarkers
            simulationPathSteps={simulationPathSteps}
            pathStepsAndSuggestedOPs={pathStepsAndSuggestedOPs}
            infraId={infraID}
          />
        )}
        {snappedPoint !== undefined && <SnappedMarker geojson={snappedPoint} />}

        {children}
      </BaseMap>
    </>
  );
};

export default ManageTimetableItemMap;
