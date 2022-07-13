import React, { FC, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { featureCollection } from '@turf/helpers';

import { EditorContext, EditorContextType } from '../../context';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import { SignalEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';
import { CreateEntityOperation, Item, SignalEntity } from '../../../../types';
import { getSignalLayerProps } from '../../../../common/Map/Layers/geoSignalsLayers';
import { cleanSymbolType } from '../../data/utils';

export const SIGNAL_LAYER_ID = 'signalEditionTool/new-signal';

export const SignalEditionLayers: FC = () => {
  const {
    state: { signal, nearestPoint, isDragging, mousePosition },
  } = useContext(EditorContext) as EditorContextType<SignalEditionState>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  const type = cleanSymbolType((signal.properties || {}).installation_type);
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
  if (isDragging && nearestPoint) {
    renderedSignal = {
      ...signal,
      geometry: nearestPoint.feature.geometry,
      properties: {
        ...signal.properties,
        angle_geo: nearestPoint.angle,
      },
    };
  } else if (signal.geometry) {
    renderedSignal = signal as SignalEntity;
  } else if (mousePosition) {
    renderedSignal = { ...signal, geometry: { type: 'Point', coordinates: mousePosition } };
  }

  return (
    <>
      {/* Zone display */}
      <EditorZone />

      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={signal.id ? [signal as Item] : undefined}
        selection={[signal as Item]}
      />

      {/* Edited signal */}
      <Source type="geojson" data={renderedSignal || featureCollection([])}>
        <Layer
          {...layerProps}
          filter={['==', 'installation_type', `"${type}"`]}
          id={SIGNAL_LAYER_ID}
        />
      </Source>
    </>
  );
};

export const SignalEditionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { state, setState } = useContext(EditorContext) as EditorContextType<SignalEditionState>;

  return (
    <EditorForm
      data={state.signal as SignalEntity}
      onSubmit={async (savedEntity) => {
        const res = await dispatch<ReturnType<typeof save>>(
          save({ [state.signal.id ? 'update' : 'create']: [savedEntity] })
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const operation = res[0] as any as CreateEntityOperation;
        const { id } = operation.railjson;

        if (id && id !== savedEntity.id) setState({ ...state, signal: { ...state.signal, id } });
      }}
      onChange={(signal) => {
        setState({ ...state, signal: signal as SignalEntity });
      }}
    >
      <div className="text-right">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!state.signal.properties?.track}
        >
          {t('common.save')}
        </button>
      </div>
    </EditorForm>
  );
};
