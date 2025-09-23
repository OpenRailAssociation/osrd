import React, { useCallback, useEffect, useMemo, useState } from 'react';

import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import type { MapRef } from 'react-map-gl/maplibre';

import captureMap from 'applications/operationalStudies/helpers/captureMap';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { MARKER_TYPE } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/ManageTimetableItemMap/ItineraryMarkers';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import MapMarkers, { type MapMarker } from 'common/Map/components/MapMarkers';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import getPointOnPathCoordinates from 'modules/pathfinding/helpers/getPointOnPathCoordinates';
import getTrackLengthCumulativeSums from 'modules/pathfinding/helpers/getTrackLengthCumulativeSums';
import Itinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';

const MAP_ID = 'simulation-result-map';

type SimulationResultMapProps = {
  pathfindingResult?: PathfindingResultSuccess;
  geometry?: PathPropertiesFormatted['geometry'];
  setMapCanvas?: (mapCanvas: string) => void;
};

const SimulationResultMap = ({
  pathfindingResult,
  geometry,
  setMapCanvas,
}: SimulationResultMapProps) => {
  const dispatch = useAppDispatch();

  const infraID = useInfraID();
  const { getTrackSectionsByIds } = useScenarioContext();

  const mapSettings = useMapSettings();
  const { removeMapSearchMarker, updateViewport } = useMapSettingsActions();
  const { viewport } = mapSettings;

  const mapRef = React.useRef<MapRef>(null);

  const geojsonPath = useMemo(() => geometry && lineString(geometry.coordinates), [geometry]);

  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);

  // Compute path items coordinates in order to place them on the map
  useEffect(() => {
    const getPathItemsCoordinates = async ({
      path,
      path_item_positions,
    }: PathfindingResultSuccess) => {
      const trackIds = path.track_section_ranges.map((range) => range.track_section);
      const tracks = await getTrackSectionsByIds(trackIds);
      const tracksLengthCumulativeSums = getTrackLengthCumulativeSums(path.track_section_ranges);

      const markers = path_item_positions.map((position, index) => {
        let pointType = MARKER_TYPE.VIA;
        if (index === 0) {
          pointType = MARKER_TYPE.ORIGIN;
        } else if (index === path_item_positions.length - 1) {
          pointType = MARKER_TYPE.DESTINATION;
        }
        return {
          coordinates: getPointOnPathCoordinates(
            tracks,
            path.track_section_ranges,
            tracksLengthCumulativeSums,
            position
          ),
          pointType,
        };
      });

      setMapMarkers(markers);
    };

    if (pathfindingResult) {
      getPathItemsCoordinates(pathfindingResult);
    }
  }, [pathfindingResult]);

  const interactiveLayerIds = useMemo(
    () => (geojsonPath ? ['geojsonPath', 'main-train-path'] : []),
    [geojsonPath]
  );

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value));
    },
    [dispatch]
  );

  const resetPitchBearing = () => {
    updateViewportChange({
      bearing: 0,
      pitch: 0,
    });
  };

  useEffect(() => {
    if (geojsonPath) {
      const newViewport = computeBBoxViewport(bbox(geojsonPath), viewport);
      updateViewportChange(newViewport);
    }
  }, [geojsonPath]);

  return (
    <>
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        bearing={viewport.bearing}
        withMapKeyButton
        viewPort={viewport}
        isNewButtons
        mapSettings={mapSettings}
      />
      <BaseMap
        mapId={MAP_ID}
        mapRef={mapRef}
        cursor="pointer"
        infraId={infraID}
        interactiveLayerIds={interactiveLayerIds}
        onClick={() => {
          dispatch(removeMapSearchMarker());
        }}
        onIdle={() => {
          captureMap(viewport, MAP_ID, setMapCanvas, geometry);
        }}
        updatePartialViewPort={updateViewportChange}
        mapSettings={mapSettings}
      >
        {geojsonPath && (
          <Itinerary geojsonPath={geojsonPath} layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]} />
        )}

        <MapMarkers markers={mapMarkers} />
      </BaseMap>
    </>
  );
};

export default SimulationResultMap;
