import React, { FC, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { featureCollection } from '@turf/helpers';

import { EditorContext, EditorContextType } from '../../context';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import { PointEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';
import {
  BufferStopEntity,
  CreateEntityOperation,
  DetectorEntity,
  EditorEntity,
  Item,
  SignalEntity,
} from '../../../../types';
import { getSignalLayerProps } from '../../../../common/Map/Layers/geoSignalsLayers';
import { cleanSymbolType } from '../../data/utils';
import {
  getDetectorsLayerProps,
  getDetectorsNameLayerProps,
} from '../../../../common/Map/Layers/Detectors';
import { getBufferStopsLayerProps } from '../../../../common/Map/Layers/BufferStops';

export const POINT_LAYER_ID = 'pointEditionTool/new-entity';

/**
 * Generic component for point edition left panel:
 */
export const PointEditionLeftPanel: FC = <Entity extends EditorEntity>() => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { state, setState } = useContext(EditorContext) as EditorContextType<
    PointEditionState<Entity>
  >;

  return (
    <EditorForm
      data={state.entity as Entity}
      onSubmit={async (savedEntity) => {
        const res = await dispatch<ReturnType<typeof save>>(
          save({ [state.entity.id ? 'update' : 'create']: [savedEntity] })
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const operation = res[0] as any as CreateEntityOperation;
        const { id } = operation.railjson;

        if (id && id !== savedEntity.id) setState({ ...state, entity: { ...state.entity, id } });
      }}
      onChange={(entity) => {
        setState({ ...state, entity: entity as Entity });
      }}
    >
      <div className="text-right">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!state.entity.properties?.track || !state.entity.geometry}
        >
          {t('common.save')}
        </button>
      </div>
    </EditorForm>
  );
};

/**
 * Specific components for specific types:
 */
export const SignalEditionLayers: FC = () => {
  const {
    state: { entity, nearestPoint, mousePosition },
  } = useContext(EditorContext) as EditorContextType<PointEditionState<SignalEntity>>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  const type = cleanSymbolType((entity.properties || {}).installation_type || '');
  const layerProps = getSignalLayerProps(
    {
      prefix: '',
      colors: colors[mapStyle],
      signalsList: [type],
      sourceLayer: 'geo',
    },
    type
  );

  let renderedSignal: SignalEntity | null = null;
  if (entity.geometry) {
    renderedSignal = entity as SignalEntity;
  } else if (nearestPoint) {
    renderedSignal = {
      ...entity,
      geometry: nearestPoint.feature.geometry,
      properties: {
        ...entity.properties,
        angle_geo: nearestPoint.angle,
      },
    };
  } else if (mousePosition) {
    renderedSignal = { ...entity, geometry: { type: 'Point', coordinates: mousePosition } };
  }

  return (
    <>
      {/* Zone display */}
      <EditorZone />

      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity.id ? [entity as Item] : undefined}
        selection={
          entity.id
            ? [entity as Item]
            : [
                {
                  ...entity,
                  id: 'NEW SIGNAL',
                } as Item,
              ]
        }
      />

      {/* Edited signal */}
      <Source type="geojson" data={renderedSignal || featureCollection([])}>
        <Layer
          {...layerProps}
          filter={['==', 'installation_type', `"${type}"`]}
          id={POINT_LAYER_ID}
        />
      </Source>
    </>
  );
};

export const DetectorEditionLayers: FC = () => {
  const {
    state: { entity, nearestPoint, mousePosition },
  } = useContext(EditorContext) as EditorContextType<PointEditionState<DetectorEntity>>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  const theme = colors[mapStyle];
  const layerProps = getDetectorsLayerProps({ colors: theme });
  const layerNameProps = getDetectorsNameLayerProps({ colors: theme });

  let renderedEntity: DetectorEntity | null = null;
  if (entity.geometry) {
    renderedEntity = entity as DetectorEntity;
  } else if (nearestPoint) {
    renderedEntity = {
      ...entity,
      geometry: nearestPoint.feature.geometry,
      properties: entity.properties,
    };
  } else if (mousePosition) {
    renderedEntity = { ...entity, geometry: { type: 'Point', coordinates: mousePosition } };
  }

  return (
    <>
      {/* Zone display */}
      <EditorZone />

      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity.id ? [entity as Item] : undefined}
        selection={
          entity.id
            ? [entity as Item]
            : [
                {
                  ...entity,
                  id: 'NEW SIGNAL',
                } as Item,
              ]
        }
      />

      {/* Edited signal */}
      <Source type="geojson" data={renderedEntity || featureCollection([])}>
        <Layer {...layerProps} id={POINT_LAYER_ID} />
        <Layer {...layerNameProps} />
      </Source>
    </>
  );
};

export const BufferStopEditionLayers: FC = () => {
  const {
    state: { entity, nearestPoint, mousePosition },
  } = useContext(EditorContext) as EditorContextType<PointEditionState<BufferStopEntity>>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  const layerProps = getBufferStopsLayerProps({});

  let renderedEntity: BufferStopEntity | null = null;
  if (entity.geometry) {
    renderedEntity = entity as BufferStopEntity;
  } else if (nearestPoint) {
    renderedEntity = {
      ...entity,
      geometry: nearestPoint.feature.geometry,
      properties: entity.properties,
    };
  } else if (mousePosition) {
    renderedEntity = { ...entity, geometry: { type: 'Point', coordinates: mousePosition } };
  }

  return (
    <>
      {/* Zone display */}
      <EditorZone />

      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity.id ? [entity as Item] : undefined}
        selection={
          entity.id
            ? [entity as Item]
            : [
                {
                  ...entity,
                  id: 'NEW SIGNAL',
                } as Item,
              ]
        }
      />

      {/* Edited signal */}
      <Source type="geojson" data={renderedEntity || featureCollection([])}>
        <Layer {...layerProps} id={POINT_LAYER_ID} />
      </Source>
    </>
  );
};
