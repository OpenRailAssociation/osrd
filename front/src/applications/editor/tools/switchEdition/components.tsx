import React, { FC, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FieldProps } from '@rjsf/core';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import { first, last, keyBy } from 'lodash';
import { FaTimesCircle, FaMapMarkedAlt } from 'react-icons/fa';
import SchemaField from '@rjsf/core/lib/components/fields/SchemaField';
import { Layer, Popup, Source } from 'react-map-gl';
import { featureCollection, point } from '@turf/helpers';
import nearestPoint from '@turf/nearest-point';
import { Position } from 'geojson';

import EditorContext from '../../context';
import Tipped from '../../components/Tipped';
import {
  EntityObjectOperationResult,
  DEFAULT_ENDPOINT,
  ENDPOINTS,
  ENDPOINTS_SET,
  SwitchEntity,
  SwitchType,
  TrackSectionEntity,
} from '../../../../types';
import colors from '../../../../common/Map/Consts/colors';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import { PortEndPointCandidate, SwitchEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';
import {
  FLAT_SWITCH_PORTS_PREFIX,
  FlatSwitchEntity,
  flatSwitchToSwitch,
  getNewSwitch,
  getSwitchTypeJSONSchema,
  isSwitchValid,
  switchToFlatSwitch,
} from './utils';
import {
  getSwitchesLayerProps,
  getSwitchesNameLayerProps,
} from '../../../../common/Map/Layers/Switches';
import { flattenEntity, NEW_ENTITY_ID } from '../../data/utils';
import EntitySumUp from '../../components/EntitySumUp';
import { getEntity } from '../../data/api';
import { getInfraID, getSwitchTypes } from '../../../../reducers/osrdconf/selectors';
import { getMap } from '../../../../reducers/map/selectors';
import { ExtendedEditorContextType } from '../editorContextTypes';

const ENDPOINT_OPTIONS = ENDPOINTS.map((s) => ({ value: s, label: s }));
const ENDPOINT_OPTIONS_DICT = keyBy(ENDPOINT_OPTIONS, 'value');

export const TrackSectionEndpointSelector: FC<FieldProps> = ({
  schema,
  formData,
  onChange,
  name,
}) => {
  const { state, setState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SwitchEditionState>;
  const { t } = useTranslation();
  const infraID = useSelector(getInfraID);

  const portId = name.replace(FLAT_SWITCH_PORTS_PREFIX, '');
  const endpoint = ENDPOINTS_SET.has(formData?.endpoint) ? formData.endpoint : DEFAULT_ENDPOINT;
  const [trackSection, setTrackSection] = useState<TrackSectionEntity | null>(null);

  const isPicking =
    state.portEditionState.type === 'selection' && state.portEditionState.portId === portId;
  const isDisabled =
    state.portEditionState.type === 'selection' && state.portEditionState.portId !== portId;

  const startPickingPort = useCallback(() => {
    // Cancel current selection:
    if (isPicking) {
      setState({
        ...state,
        portEditionState: {
          type: 'idle',
        },
      });
    }
    // Start selecting:
    else if (!isDisabled) {
      setState({
        ...state,
        portEditionState: {
          type: 'selection',
          portId,
          hoveredPoint: null,
          onSelect: (hoveredPoint: PortEndPointCandidate) => {
            setState({ ...state, portEditionState: { type: 'idle' } });
            onChange({
              endpoint: hoveredPoint.endPoint,
              track: hoveredPoint.trackSectionId,
            });
          },
        },
      });
    }
  }, [isDisabled, isPicking, onChange, portId, setState, state]);

  useEffect(() => {
    if (typeof formData?.track === 'string') {
      getEntity<TrackSectionEntity>(infraID as number, formData.track, 'TrackSection').then(
        (track) => {
          setTrackSection(track);
        }
      );
    } else {
      setTrackSection(null);
    }
  }, [formData?.track, infraID]);

  return (
    <div className="mb-4">
      {schema.title && <h5>{schema.title}</h5>}
      {schema.description && <p>{schema.description}</p>}
      <div className="d-flex flex-row align-items-center mb-2">
        <div className="flex-grow-1 flex-shrink-1 mr-2">
          {trackSection ? (
            <span>
              {trackSection?.properties?.extensions?.sncf?.line_name || trackSection.properties.id}
            </span>
          ) : (
            <span className="text-danger font-weight-bold">
              {t('Editor.tools.switch-edition.no-track-picked-yet')}
            </span>
          )}
          {!!trackSection && <div className="text-muted small">{trackSection.properties.id}</div>}
          {!!trackSection && (
            <div className="d-flex flex-row align-items-baseline mb-2">
              <span className="mr-2">{t('Editor.tools.switch-edition.endpoint')}</span>
              <Select
                value={ENDPOINT_OPTIONS_DICT[endpoint]}
                options={ENDPOINT_OPTIONS}
                onChange={(o) => {
                  if (o)
                    onChange({
                      endpoint: o.value,
                      track: trackSection.properties.id,
                    });
                }}
              />
            </div>
          )}
        </div>
        <Tipped mode="left">
          <button
            type="button"
            className="btn btn-primary px-3"
            onClick={startPickingPort}
            disabled={isDisabled}
          >
            {isPicking ? <FaTimesCircle /> : <FaMapMarkedAlt />}
          </button>
          <span>
            {t(
              `Editor.tools.switch-edition.actions.${
                isPicking ? 'pick-track-cancel' : 'pick-track'
              }`
            )}
          </span>
        </Tipped>
      </div>
    </div>
  );
};

export const CustomSchemaField: FC<FieldProps> = (props) => {
  const { name = '' } = props;
  if (name.indexOf(FLAT_SWITCH_PORTS_PREFIX) !== 0) return <SchemaField {...props} />;

  return <TrackSectionEndpointSelector {...props} />;
};

export const SwitchEditionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { state, setState, editorState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SwitchEditionState>;

  // Retrieve base JSON schema:
  const baseSchema = editorState.editorSchema.find((e) => e.objType === 'Switch')?.schema;

  // Retrieve proper data
  const switchTypes = useSelector(getSwitchTypes);
  const switchTypesDict = useMemo(() => keyBy(switchTypes, 'id'), [switchTypes]);
  const switchTypeOptions = useMemo(
    () =>
      (switchTypes || []).map((type) => ({
        value: type.id,
        label: `${type.id} (${type.ports.length} port${type.ports.length > 1 ? 's' : ''})`,
      })),
    [switchTypes]
  );
  const switchTypeOptionsDict = useMemo(
    () => keyBy(switchTypeOptions, 'value'),
    [switchTypeOptions]
  );
  const switchEntity = state.entity as SwitchEntity;
  const isNew = switchEntity.properties.id === NEW_ENTITY_ID;
  const switchType = useMemo(
    () =>
      switchTypes?.find((type) => type.id === switchEntity.properties.switch_type) ||
      (first(switchTypes || []) as SwitchType),
    [switchEntity.properties.switch_type, switchTypes]
  );
  const flatSwitchEntity = useMemo(
    () => switchToFlatSwitch(switchType, switchEntity),
    [switchEntity, switchType]
  );
  const switchTypeJSONSchema = useMemo(
    () => baseSchema && getSwitchTypeJSONSchema(baseSchema, switchType),
    [baseSchema, switchType]
  );

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

          if (id && id !== entityToSave.properties.id)
            setState({
              ...state,
              entity: { ...entityToSave, properties: { ...entityToSave.properties, id: `${id}` } },
            });
        }}
        onChange={(entity) => {
          const flatSwitch = entity as FlatSwitchEntity;
          setState({
            ...state,
            entity: {
              ...flatSwitchToSwitch(switchType, flatSwitch),
              geometry: flatSwitch.geometry,
            },
          });
        }}
      >
        <div className="text-right">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              !switchType ||
              !isSwitchValid(switchEntity, switchType) ||
              state.portEditionState.type !== 'idle'
            }
          >
            {t('common.save')}
          </button>
        </div>
      </EditorForm>
    </div>
  );
};

export const SwitchEditionLayers: FC = () => {
  const { t } = useTranslation();
  const switchTypes = useSelector(getSwitchTypes);
  const infraID = useSelector(getInfraID);
  const {
    renderingFingerprint,
    state,
    setState,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<SwitchEditionState>;
  const { entity, hovered, portEditionState, mousePosition } = state;
  const switchTypesDict = useMemo(() => keyBy(switchTypes, 'id'), [switchTypes]);
  const switchType = useMemo(
    () => (entity.properties?.switch_type ? switchTypesDict[entity.properties.switch_type] : null),
    [entity.properties?.switch_type, switchTypesDict]
  );
  const { mapStyle, layersSettings } = useSelector(getMap);
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
      getEntity<TrackSectionEntity>(infraID as number, hoveredTrackId, 'TrackSection')
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
      getEntity<TrackSectionEntity>(infraID as number, port.track, 'TrackSection').then((track) => {
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
      });
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
      />

      {/* Edited switch */}
      <Source
        type="geojson"
        data={geometryState.entity ? flattenEntity(geometryState.entity) : featureCollection([])}
      >
        <Layer {...layerProps} />
        <Layer {...nameLayerProps} />
      </Source>
      {geometryState.entity && (
        <Popup
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
