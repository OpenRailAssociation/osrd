import React, { FC, useCallback, useContext, useMemo, useState } from 'react';
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

import { EditorContext } from '../../context';
import { ExtendedEditorContextType, OSRDConf } from '../types';
import {
  CreateEntityOperation,
  DEFAULT_ENDPOINT,
  ENDPOINTS,
  ENDPOINTS_SET,
  SwitchEntity,
  SwitchType,
  TrackSectionEntity,
} from '../../../../types';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import { SwitchEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';
import {
  FLAT_SWITCH_PORTS_PREFIX,
  FlatSwitchEntity,
  flatSwitchToSwitch,
  getNewSwitch,
  getSwitchTypeJSONSchema,
  injectGeometry,
  isSwitchValid,
  switchToFlatSwitch,
} from './utils';
import {
  getSwitchesLayerProps,
  getSwitchesNameLayerProps,
} from '../../../../common/Map/Layers/Switches';
import { NEW_ENTITY_ID } from '../../data/utils';
import EntitySumUp from '../../components/EntitySumUp';

const ENDPOINT_OPTIONS = ENDPOINTS.map((s) => ({ value: s, label: s }));
const ENDPOINT_OPTIONS_DICT = keyBy(ENDPOINT_OPTIONS, 'value');

export const TrackSectionEndpointSelector: FC<FieldProps> = ({
  schema,
  formData,
  onChange,
  name,
}) => {
  const {
    editorState: { entitiesIndex },
    state,
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<SwitchEditionState>;
  const { t } = useTranslation();

  const portId = name.replace(FLAT_SWITCH_PORTS_PREFIX, '');
  const endpoint = ENDPOINTS_SET.has(formData?.endpoint) ? formData.endpoint : DEFAULT_ENDPOINT;
  const trackSection =
    typeof formData?.track === 'string' ? entitiesIndex[formData.track] : undefined;

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
          onSelect: (trackId: string, position: [number, number]) => {
            const track = entitiesIndex[trackId] as TrackSectionEntity;
            const closest = nearestPoint(
              position,
              featureCollection([
                point(first(track.geometry.coordinates) as [number, number]),
                point(last(track.geometry.coordinates) as [number, number]),
              ])
            );
            setState({ ...state, portEditionState: { type: 'idle' } });
            onChange({
              endpoint: closest.properties.featureIndex === 0 ? 'BEGIN' : 'END',
              track: trackId,
            });
          },
        },
      });
    }
  }, [entitiesIndex, isDisabled, isPicking, onChange, portId, setState, state]);

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
        <button
          type="button"
          className="btn btn-primary px-3"
          onClick={startPickingPort}
          disabled={isDisabled}
        >
          {isPicking ? <FaTimesCircle /> : <FaMapMarkedAlt />}
        </button>
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
  const tracksIndex = editorState.entitiesIndex as Record<string, TrackSectionEntity>;
  const { switchTypes } = useSelector(({ osrdconf }: { osrdconf: OSRDConf }) => osrdconf);
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
      <legend>Switch Type</legend>
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
          const entityToSave = injectGeometry(
            flatSwitchToSwitch(switchType, flatSwitch as FlatSwitchEntity),
            switchType,
            tracksIndex
          ) as SwitchEntity;

          const res: any = await dispatch(
            save(
              !isNew
                ? {
                    update: [
                      {
                        source: editorState.entitiesIndex[entityToSave.properties.id],
                        target: entityToSave,
                      },
                    ],
                  }
                : { create: [entityToSave] }
            )
          );
          const operation = res[0] as CreateEntityOperation;
          const { id } = operation.railjson;

          if (id && id !== entityToSave.properties.id)
            setState({
              ...state,
              entity: { ...entityToSave, properties: { ...entityToSave.properties, id: id + '' } },
            });
        }}
        onChange={(flatSwitch) => {
          setState({
            ...state,
            entity: injectGeometry(
              flatSwitchToSwitch(switchType, flatSwitch as FlatSwitchEntity),
              switchType,
              tracksIndex
            ),
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
  const [showPopup, setShowPopup] = useState(true);
  const {
    state: { entity, hovered, portEditionState, mousePosition },
    editorState: { entitiesIndex },
  } = useContext(EditorContext) as ExtendedEditorContextType<SwitchEditionState>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };
  const layerProps = getSwitchesLayerProps({
    colors: colors[mapStyle],
  });
  const nameLayerProps = getSwitchesNameLayerProps({
    colors: colors[mapStyle],
  });
  const hoveredTrack = hovered
    ? (entitiesIndex[hovered.properties.id] as TrackSectionEntity)
    : null;

  const closest =
    portEditionState.type === 'selection' && hoveredTrack && mousePosition
      ? nearestPoint(
          mousePosition,
          featureCollection([
            point(first(hoveredTrack.geometry.coordinates) as [number, number]),
            point(last(hoveredTrack.geometry.coordinates) as [number, number]),
          ])
        )
      : null;
  const closestPoint = closest
    ? point(closest.geometry.coordinates, {
        name: closest.properties.featureIndex === 0 ? 'BEGIN' : 'END',
      })
    : null;

  return (
    <>
      {/* Zone display */}
      <EditorZone />

      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity?.properties?.id ? [entity.properties.id] : undefined}
        selection={entity?.properties?.id ? [entity.properties.id] : undefined}
      />

      {/* Edited switch */}
      <Source type="geojson" data={(entity as SwitchEntity) || featureCollection([])}>
        <Layer {...layerProps} />
        <Layer {...nameLayerProps} />
      </Source>
      {showPopup && entity && entity.geometry?.type === 'Point' && (
        <Popup
          className="popup py-2"
          anchor="bottom"
          longitude={entity.geometry.coordinates[0]}
          latitude={entity.geometry.coordinates[1]}
          onClose={() => setShowPopup(false)}
        >
          <EntitySumUp entity={entity as SwitchEntity} status="edited" />
        </Popup>
      )}

      {/* Hovered track section */}
      {portEditionState.type === 'selection' && hoveredTrack && mousePosition && closestPoint && (
        <>
          <Popup
            className="popup"
            anchor="bottom"
            longitude={mousePosition[0]}
            latitude={mousePosition[1]}
            closeButton={false}
          >
            {`${
              hoveredTrack.properties?.extensions?.sncf?.line_name ||
              t('Editor.tools.switch-edition.untitled-track')
            } (${closestPoint.properties.name})`}
            <div className="text-muted small">{hoveredTrack.properties.id}</div>
          </Popup>

          <Source type="geojson" data={closestPoint}>
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
    ? t('Editor.tools.switch-edition.select-track')
    : null;
};
