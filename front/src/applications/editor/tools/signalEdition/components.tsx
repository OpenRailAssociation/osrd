import React, { FC, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';

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
    state: { signal, nearestPoint, isDragging },
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

  const renderedSignal: SignalEntity =
    isDragging && nearestPoint
      ? {
          ...signal,
          geometry: nearestPoint.feature.geometry,
        }
      : signal;

  return (
    <>
      {/* Zone display */}
      <EditorZone />

      {/* Editor data layer */}
      <GeoJSONs colors={colors[mapStyle]} hidden={signal.id ? [signal as Item] : undefined} />

      {/* Edited signal */}
      <Source type="geojson" data={renderedSignal}>
        <Layer
          {...layerProps}
          filter={['==', 'installation_type', `"${type}"`]}
          paint={{
            ...(layerProps.paint || {}),
            'icon-halo-width': 5,
            'icon-halo-color': 'rgba(0, 0, 0, 1)',
            'icon-halo-blur': 0,
          }}
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
      data={state.signal}
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
