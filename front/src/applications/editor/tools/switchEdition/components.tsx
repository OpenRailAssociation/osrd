import React, { FC, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import { first, last, debounce } from 'lodash';
import { Layer, Popup, Source } from 'react-map-gl/maplibre';
import { featureCollection, point } from '@turf/helpers';
import nearestPoint from '@turf/nearest-point';
import { Position } from 'geojson';

import EditorForm from 'applications/editor//components/EditorForm';
import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EntityError from 'applications/editor/components/EntityError';
import EditorContext from 'applications/editor/context';
import { getEntity } from 'applications/editor/data/api';
import { flattenEntity } from 'applications/editor/data/utils';
import { ExtendedEditorContextType } from 'applications/editor/tools/editorContextTypes';
import colors from 'common/Map/Consts/colors';
import GeoJSONs from 'common/Map/Layers/GeoJSONs';
import { getSwitchesLayerProps, getSwitchesNameLayerProps } from 'common/Map/Layers/Switches';
import { save } from 'reducers/editor';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';
import { EntityObjectOperationResult, SwitchEntity, TrackSectionEntity } from 'types';

import { FlatSwitchEntity, flatSwitchToSwitch, getNewSwitch } from './utils';
import { SwitchEditionState } from './types';
import useSwitch from './useSwitch';
import { CustomSchemaField } from './components/CustomSchemaField';

export const SwitchEditionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const infraID = useSelector(getInfraID);
  const { state, setState, isFormSubmited, setIsFormSubmited } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SwitchEditionState>;
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Retrieve proper data
  const {
    switchEntity,
    flatSwitchEntity,
    switchType,
    switchTypeOptions,
    switchTypeOptionsDict,
    switchTypesDict,
    switchTypeJSONSchema,
    isNew,
  } = useSwitch();

  if (!switchType || !flatSwitchEntity) {
    return null;
  }

  // Hack to be able to launch the submit event from the rjsf form by using
  // the toolbar button instead of the form one.
  // See https://github.com/rjsf-team/react-jsonschema-form/issues/500
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited && submitBtnRef.current) {
      submitBtnRef.current.click();
      setIsFormSubmited(false);
    }
  }, [isFormSubmited]);

  return (
    <div>
      <legend>{t('Editor.tools.switch-edition.switch-type')}</legend>
      <Select
        options={switchTypeOptions}
        value={switchTypeOptionsDict[switchType.id]}
        onChange={(o) => {
          if (o && o.value !== switchType.id) {
            const newEntity = getNewSwitch(switchTypesDict[o.value]);
            setState({
              ...state,
              entity: newEntity,
              initialEntity: newEntity,
            });
          }
        }}
        isDisabled={!isNew}
      />
      <hr />
      <EditorForm
        key={switchType.id}
        data={flatSwitchEntity}
        overrideSchema={switchTypeJSONSchema}
        overrideFields={{
          SchemaField: CustomSchemaField,
        }}
        onSubmit={async (flatSwitch) => {
          const entityToSave = flatSwitchToSwitch(switchType, flatSwitch as FlatSwitchEntity);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res: any = await dispatch(
            save(
              infraID,
              !isNew
                ? {
                    update: [
                      {
                        source: state.initialEntity as SwitchEntity,
                        target: entityToSave,
                      },
                    ],
                  }
                : { create: [entityToSave] }
            )
          );
          const operation = res[0] as EntityObjectOperationResult;
          const { id } = operation.railjson;

          if (id && id !== entityToSave.properties.id) {
            const savedEntity = {
              ...entityToSave,
              properties: { ...entityToSave.properties, id: `${id}` },
            };
            setState({
              ...state,
              initialEntity: savedEntity,
              entity: savedEntity,
            });
          }
        }}
        onChange={debounce((entity) => {
          const flatSwitch = entity as FlatSwitchEntity;
          setState({
            ...state,
            portEditionState: { type: 'idle' },
            entity: {
              ...flatSwitchToSwitch(switchType, flatSwitch),
              geometry: flatSwitch.geometry,
            },
          });
        }, 200)}
      >
        <div>
          {/* We don't want to see the button but just be able to click on it */}
          <button type="submit" ref={submitBtnRef} style={{ display: 'none' }}>
            {t('common.save')}
          </button>
        </div>
      </EditorForm>
      {!isNew && <EntityError className="mt-1" entity={switchEntity} />}
    </div>
  );
};

export const SwitchEditionLayers: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const infraID = useSelector(getInfraID);
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
      getEntity<TrackSectionEntity>(infraID as number, hoveredTrackId, 'TrackSection', dispatch)
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
      getEntity<TrackSectionEntity>(infraID as number, port.track, 'TrackSection', dispatch).then(
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
  }, [entity?.properties?.ports, infraID]);

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

export const SwitchMessages: FC = () => {
  const { t } = useTranslation();
  const {
    state: { portEditionState },
  } = useContext(EditorContext) as ExtendedEditorContextType<SwitchEditionState>;
  return portEditionState.type === 'selection'
    ? t('Editor.tools.switch-edition.help.select-track')
    : t('Editor.tools.switch-edition.help.no-move');
};
