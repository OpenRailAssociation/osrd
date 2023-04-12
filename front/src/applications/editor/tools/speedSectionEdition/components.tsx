import { mapValues, without } from 'lodash';
import { useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { featureCollection } from '@turf/helpers';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';
import React, { FC, useContext, useEffect, useMemo, useState } from 'react';

import EditorContext from '../../context';
import { SpeedSectionEditionState } from './types';
import { ExtendedEditorContextType } from '../types';
import colors from '../../../../common/Map/Consts/colors';
import GeoJSONs, { SourcesDefinitionsIndex } from '../../../../common/Map/Layers/GeoJSONs';
import { getMap } from '../../../../reducers/map/selectors';
import { TrackSectionEntity } from '../../../../types';
import { getEntities } from '../../data/api';
import { getInfraID } from '../../../../reducers/osrdconf/selectors';
import { getTrackRangeFeatures } from './utils';
import { flattenEntity } from '../../data/utils';

type TrackState =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'success'; track: TrackSectionEntity };

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
    state: { entity },
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;
  const { mapStyle, layersSettings, showIGNBDORTHO } = useSelector(getMap);
  const infraId = useSelector(getInfraID);

  const [trackSectionsCache, setTrackSectionsCache] = useState<Record<string, TrackState>>({});
  const speedSectionsFeature: FeatureCollection = useMemo(() => {
    const flatEntity = flattenEntity(entity);
    const trackRanges = entity.properties?.track_ranges || [];
    return featureCollection(
      trackRanges.flatMap((range) => {
        const trackState = trackSectionsCache[range.track];
        return trackState?.type === 'success'
          ? getTrackRangeFeatures(trackState.track, range, flatEntity.properties)
          : [];
      }) as Feature<LineString | Point>[]
    );
  }, [entity, trackSectionsCache]);
  const layersProps = useMemo(
    () =>
      SourcesDefinitionsIndex.speed_sections(
        {
          sourceLayer: 'geo',
          prefix: mapStyle === 'blueprint' ? 'SCHB ' : '',
          colors: colors[mapStyle],
          signalsList: [],
          symbolsList: [],
          isEmphasized: true,
          showIGNBDORTHO,
          layersSettings,
        },
        'speedSectionsEditor/'
      ),
    [mapStyle, showIGNBDORTHO, layersSettings]
  );

  const layers = useMemo(() => {
    if (!editorLayers.has('speed_sections')) return editorLayers;
    return new Set(without(Array.from(editorLayers), 'speed_sections'));
  }, [editorLayers]);

  useEffect(() => {
    const trackIDs = entity.properties?.track_ranges?.map((range) => range.track) || [];
    const missingTrackIDs = trackIDs.filter((id) => !trackSectionsCache[id]);

    if (missingTrackIDs.length) {
      setTrackSectionsCache((cache) =>
        missingTrackIDs.reduce((iter, id) => ({ ...iter, [id]: { type: 'loading' } }), cache)
      );

      getEntities<TrackSectionEntity>(infraId as number, missingTrackIDs, 'TrackSection').then(
        (res) => {
          setTrackSectionsCache((cache) => ({
            ...cache,
            ...mapValues(res, (track) => ({ type: 'success', track } as TrackState)),
          }));
        }
      );
    }
  }, [entity.properties?.track_ranges]);

  return (
    <>
      <GeoJSONs
        colors={colors[mapStyle]}
        layers={layers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        isEmphasized={false}
        beforeId={layersProps[0].id}
      />
      <Source type="geojson" data={speedSectionsFeature}>
        {layersProps.map((props, i) => (
          <Layer {...props} key={i} />
        ))}
        <Layer
          type="circle"
          paint={{
            'circle-radius': 4,
            'circle-color': '#fff',
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 2,
          }}
          filter={['has', 'position']}
        />
      </Source>
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
