import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import bbox from '@turf/bbox';
import type { Feature, Point } from 'geojson';
import { compact } from 'lodash';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';

import captureMap from 'applications/operationalStudies/helpers/captureMap';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { PathProperties } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import colors from 'common/Map/Consts/colors';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import SnappedMarker from 'common/Map/Layers/SnappedMarker';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import AddPathStepPopup from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/AddPathStepPopup';
import { mapInitialState } from 'reducers/map';
import type { Viewport } from 'reducers/map';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import ItineraryLayer from './ManageTrainScheduleMap/ItineraryLayer';
import ItineraryMarkers, {
  type MarkerInformation,
} from './ManageTrainScheduleMap/ItineraryMarkers';
import type { FeatureInfoClick } from './types';

type MapProps = {
  initialViewport?: Partial<Viewport>;
  withSearchButton?: boolean;
  withToggleLayersButton?: boolean;
  withMapKeyButton?: boolean;
  pathProperties?: ManageTrainSchedulePathProperties;
  pathGeometry?: NonNullable<PathProperties['geometry']>;
  setMapCanvas?: (mapCanvas: string) => void;
  hideAttribution?: boolean;
  hideItinerary?: boolean;
  preventPointSelection?: boolean;
  id: string;
  simulationPathSteps: MarkerInformation[];
  showStdcmAssets?: boolean;
  isFeasible?: boolean;
};

const ZOOM_DEFAULT = 5;
const ZOOM_DELTA = 1.5;

const NewMap = ({
  initialViewport = {},
  withSearchButton = false,
  withToggleLayersButton = false,
  withMapKeyButton = false,
  pathProperties,
  pathGeometry: geometry,
  setMapCanvas,
  hideAttribution = false,
  hideItinerary = false,
  preventPointSelection = false,
  id,
  simulationPathSteps,
  showStdcmAssets = false,
  isFeasible = true,
  children,
}: PropsWithChildren<MapProps>) => {
  const infraID = useInfraID();
  const [mapState, setMapState] = useState({
    ...mapInitialState,
    viewport: {
      ...mapInitialState.viewport,
      ...initialViewport,
    },
  });

  const { viewport, mapSearchMarker, mapStyle, showOSM, layersSettings, terrain3DExaggeration } =
    mapState;

  const pathGeometry = useMemo(
    () => geometry || pathProperties?.geometry,
    [pathProperties, geometry]
  );

  const [snappedPoint, setSnappedPoint] = useState<Feature<Point> | undefined>();

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) =>
      setMapState((prev) => ({
        ...prev,
        viewport: {
          ...prev.viewport,
          ...value,
        },
      })),
    []
  );

  const mapRef = useRef<MapRef | null>(null);

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

  const zoomIn = () => {
    updateViewportChange({
      ...viewport,
      zoom: (viewport.zoom || ZOOM_DEFAULT) + ZOOM_DELTA,
    });
  };
  const zoomOut = () => {
    updateViewportChange({
      ...viewport,
      zoom: (viewport.zoom || ZOOM_DEFAULT) - ZOOM_DELTA,
    });
  };
  const removeSearchItemMarkersOnMap = () => {
    setMapState((prev) => ({
      ...prev,
      mapSearchMarker: undefined,
      lineSearchCode: undefined,
    }));
  };

  const onFeatureClick = (e: MapLayerMouseEvent) => {
    if (preventPointSelection) return;
    const result = getMapMouseEventNearestFeature(e, { layersId: ['chartis/tracks-geo/main'] });
    if (result?.feature.properties?.id && result?.feature.geometry.type === 'LineString') {
      setFeatureInfoClick({
        feature: result.feature,
        coordinates: result.nearest,
        isOperationalPoint: false,
      });
    } else {
      setFeatureInfoClick(undefined);
    }
    removeSearchItemMarkersOnMap();
  };

  const onMoveGetFeature = (e: MapLayerMouseEvent) => {
    if (preventPointSelection) return;
    const result = getMapMouseEventNearestFeature(e, { layersId: ['chartis/tracks-geo/main'] });
    if (result?.feature.properties?.id && result?.feature.geometry.type === 'LineString') {
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
      setSnappedPoint(undefined);
    }
  };

  const interactiveLayerIds = useMemo(() => {
    const result: Array<string> = [];
    result.push('chartis/tracks-geo/main');
    if (layersSettings.operationalpoints) {
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
      const newViewport = computeBBoxViewport(bbox(points), viewport);
      updateViewportChange(newViewport);
    }
  }, [pathGeometry, simulationPathSteps]);

  return (
    <>
      <MapButtons
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        closeFeatureInfoClickPopup={closeFeatureInfoClickPopup}
        bearing={viewport.bearing}
        withMapKeyButton={withMapKeyButton}
        withSearchButton={withSearchButton}
        withToggleLayersButton={withToggleLayersButton}
        viewPort={viewport}
        isNewButtons
      />
      <BaseMap
        mapId={id}
        mapRef={mapRef}
        cursor={preventPointSelection ? 'default' : 'pointer'}
        hideAttribution={hideAttribution}
        infraId={infraID}
        interactiveLayerIds={interactiveLayerIds}
        mapSearchMarker={mapSearchMarker}
        mapStyle={mapStyle}
        onClick={onFeatureClick}
        onIdle={() => {
          captureMap(viewport, id, setMapCanvas, pathGeometry);
        }}
        onMouseMove={onMoveGetFeature}
        showOSM={showOSM}
        viewPort={viewport}
        updatePartialViewPort={updateViewportChange}
        terrain3DExaggeration={terrain3DExaggeration}
      >
        {!showStdcmAssets && featureInfoClick && (
          <AddPathStepPopup
            pathProperties={pathProperties}
            featureInfoClick={featureInfoClick}
            resetFeatureInfoClick={resetFeatureInfoClick}
          />
        )}

        <ItineraryLayer
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]}
          geometry={pathGeometry}
          hideItineraryLine={hideItinerary}
          showStdcmAssets={showStdcmAssets}
          isFeasible={isFeasible}
        />
        {infraID && (
          <ItineraryMarkers
            simulationPathSteps={simulationPathSteps}
            showStdcmAssets={showStdcmAssets}
            infraId={infraID}
          />
        )}
        {mapSearchMarker && <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />}
        {snappedPoint !== undefined && <SnappedMarker geojson={snappedPoint} />}

        {children}
      </BaseMap>
    </>
  );
};

export default NewMap;
