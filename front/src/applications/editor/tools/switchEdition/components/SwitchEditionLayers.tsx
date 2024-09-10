import { useContext, useEffect, useMemo, useState } from 'react';

import { featureCollection, point } from '@turf/helpers';
import nearestPoint from '@turf/nearest-point';
import type { Position } from 'geojson';
import { first, last } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Layer, Popup, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { getEntity } from 'applications/editor/data/api';
import { flattenEntity } from 'applications/editor/data/utils';
import type {
  SwitchEditionState,
  SwitchEntity,
} from 'applications/editor/tools/switchEdition/types';
import useSwitch from 'applications/editor/tools/switchEdition/useSwitch';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import colors from 'common/Map/Consts/colors';
import GeoJSONs from 'common/Map/Layers/GeoJSONs';
import { getSwitchesLayerProps, getSwitchesNameLayerProps } from 'common/Map/Layers/Switches';
import { useInfraID } from 'common/osrdContext';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

const SwitchEditionLayers = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const {
    renderingFingerprint,
    state,
    setState,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<SwitchEditionState>;
  const { entity, hovered, portEditionState, mousePosition } = state;

  const { switchType } = useSwitch();
  const { mapStyle, layersSettings, issuesSettings } = useSelector(getMap);
  const layerProps = useMemo(
    () =>
      getSwitchesLayerProps({
        colors: colors[mapStyle],
      }),
    [mapStyle]
  );
  const nameLayerProps = useMemo(
    () =>
      getSwitchesNameLayerProps({
        colors: colors[mapStyle],
      }),
    [mapStyle]
  );
  const hoveredTrackId = useMemo(() => hovered?.type === 'TrackSection' && hovered.id, [hovered]);
  const [trackStatus, setTrackStatus] = useState<
    | { type: 'idle' }
    | { type: 'loading'; trackSectionID: string }
    | { type: 'error'; trackSectionID: string; message?: string }
    | { type: 'loaded'; trackSection: TrackSectionEntity }
  >({ type: 'idle' });

  // Load the accurate TrackSection to search for the proper endpoint:
  useEffect(() => {
    if (!hoveredTrackId) {
      setTrackStatus({ type: 'idle' });
    } else if (
      trackStatus.type === 'idle' ||
      (trackStatus.type === 'loading' && trackStatus.trackSectionID !== hoveredTrackId) ||
      (trackStatus.type === 'loaded' && trackStatus.trackSection.properties.id !== hoveredTrackId)
    ) {
      setTrackStatus({ type: 'loading', trackSectionID: hoveredTrackId });
      getEntity<TrackSectionEntity>(infraID!, hoveredTrackId, 'TrackSection', dispatch)
        .then((trackSection) => {
          setTrackStatus({ type: 'loaded', trackSection });
        })
        .catch((e: unknown) => {
          setTrackStatus({
            type: 'error',
            trackSectionID: hoveredTrackId,
            message: e instanceof Error ? e.message : undefined,
          });
        });
    }
  }, [hoveredTrackId]);

  // Update the hoveredPoint value in the state:
  useEffect(() => {
    if (portEditionState.type !== 'selection') return;
    if (trackStatus.type !== 'loaded' || !mousePosition) {
      setState({ ...state, portEditionState: { ...portEditionState, hoveredPoint: null } });
      return;
    }

    const hoveredTrack = trackStatus.trackSection;
    const trackSectionPoints = hoveredTrack.geometry.coordinates;
    const closest = nearestPoint(
      mousePosition,
      featureCollection([
        point(first(trackSectionPoints) as Position),
        point(last(trackSectionPoints) as Position),
      ])
    );

    setState({
      ...state,
      portEditionState: {
        ...portEditionState,
        hoveredPoint: {
          endPoint: closest.properties.featureIndex === 0 ? 'BEGIN' : 'END',
          position: closest.geometry.coordinates,
          trackSectionId: hoveredTrack.properties.id,
          trackSectionName:
            hoveredTrack.properties?.extensions?.sncf?.track_name ||
            t('Editor.tools.switch-edition.untitled-track'),
        },
      },
    });
  }, [trackStatus, mousePosition, t]);

  const [geometryState, setGeometryState] = useState<
    { type: 'loading'; entity?: undefined } | { type: 'ready'; entity?: SwitchEntity }
  >({ type: 'ready' });

  useEffect(() => {
    const port =
      entity.properties?.ports && switchType
        ? entity.properties.ports[switchType.ports[0]]
        : undefined;

    if (!port?.track) {
      setGeometryState({ type: 'ready' });
    } else {
      setGeometryState({ type: 'loading' });
      getEntity<TrackSectionEntity>(infraID!, port.track, 'TrackSection', dispatch).then(
        (track) => {
          if (!track || !track.geometry.coordinates.length) setGeometryState({ type: 'ready' });

          const coordinates =
            port.endpoint === 'BEGIN'
              ? first(track.geometry.coordinates)
              : last(track.geometry.coordinates);
          setGeometryState({
            type: 'ready',
            entity: {
              ...(entity as SwitchEntity),
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: coordinates as [number, number],
              },
            },
          });
        }
      );
    }
  }, [entity?.properties?.ports, infraID, switchType]);

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity?.properties?.id ? [entity.properties.id] : undefined}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        infraID={infraID}
      />

      {/* Edited switch */}
      <Source
        type="geojson"
        data={geometryState.entity ? flattenEntity(geometryState.entity) : featureCollection([])}
      >
        <Layer {...layerProps} />
        <Layer {...nameLayerProps} />
      </Source>

      {/* Map popin of the edited switch */}
      {geometryState.entity && (
        <Popup
          focusAfterOpen={false}
          className="popup py-2"
          anchor="bottom"
          longitude={geometryState.entity.geometry.coordinates[0]}
          latitude={geometryState.entity.geometry.coordinates[1]}
        >
          <EntitySumUp entity={entity as SwitchEntity} status="edited" />
        </Popup>
      )}

      {/* Hovered track section */}
      {portEditionState.type === 'selection' && portEditionState.hoveredPoint && mousePosition && (
        <>
          <Popup
            className="popup"
            anchor="bottom"
            longitude={mousePosition[0]}
            latitude={mousePosition[1]}
            closeButton={false}
          >
            {`${portEditionState.hoveredPoint.trackSectionName} (${portEditionState.hoveredPoint.endPoint})`}
            <div className="text-muted small">{portEditionState.hoveredPoint.trackSectionId}</div>
          </Popup>

          <Source type="geojson" data={point(portEditionState.hoveredPoint.position)}>
            <Layer {...layerProps} />
          </Source>
        </>
      )}
    </>
  );
};

export default SwitchEditionLayers;
