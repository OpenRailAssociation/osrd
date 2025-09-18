import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';

import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { useInfraID } from 'common/osrdContext';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import type { FeatureInfoClick } from '../types';

const OPERATIONAL_POINT_LAYERS = [
  'chartis/osrd_operational_point/geo',
  'chartis/osrd_operational_point_name/geo',
];

const ItineraryModalMap = ({ children }: PropsWithChildren) => {
  const dispatch = useAppDispatch();

  const infraID = useInfraID();
  const mapSettings = useMapSettings();
  const { viewport, layersSettings } = mapSettings;
  const { removeMapSearchMarker, updateViewport } = useMapSettingsActions();

  const mapRef = useRef<MapRef | null>(null);

  const [hoveredOperationalPointId, setHoveredOperationalPointId] = useState<string>();

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value));
    },
    [dispatch]
  );

  const [featureInfoClick, setFeatureInfoClick] = useState<FeatureInfoClick>();

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
    } else {
      setHoveredOperationalPointId(undefined);
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
        layersModalContainer={document.querySelector('.itinerary-modal-map')}
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
        {children}
      </BaseMap>
    </>
  );
};

export default ItineraryModalMap;
