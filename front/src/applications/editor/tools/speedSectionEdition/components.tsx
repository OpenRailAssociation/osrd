import { useSelector } from 'react-redux';
import React, { FC, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import EditorContext from '../../context';
import { SpeedSectionEditionState } from './types';
import { ExtendedEditorContextType } from '../types';
import colors from '../../../../common/Map/Consts/colors';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import { getMap } from '../../../../reducers/map/selectors';
import { without } from 'lodash';
import { Layer, Source } from 'react-map-gl';
import { flattenEntity } from '../../data/utils';
import { featureCollection } from '@turf/helpers';

export const SpeedSectionEditionLeftPanel: FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <legend>{t('Editor.tools.switch-edition.speed-section-type')}</legend>
    </div>
  );
};

export const SpeedSectionEditionLayers: FC = () => {
  const {
    renderingFingerprint,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;
  const { mapStyle, layersSettings } = useSelector(getMap);

  const layers = useMemo(() => {
    if (!editorLayers.has('speed_sections')) return editorLayers;
    return new Set(without(Array.from(editorLayers), 'speed_sections'));
  }, [editorLayers]);

  return (
    <>
      <GeoJSONs
        colors={colors[mapStyle]}
        layers={layers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
      />
    </>
  );
};

export const SpeedSectionMessages: FC = () => {
  // const { t } = useTranslation();
  const {
    state: {
      /* TODO */
    },
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;
  return null;
};
