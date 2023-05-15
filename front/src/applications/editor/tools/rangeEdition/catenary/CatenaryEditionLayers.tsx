import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import React, { FC, useContext, useEffect, useMemo } from 'react';
import { getMap } from 'reducers/map/selectors';
import EditorContext from 'applications/editor/context';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { flattenEntity } from 'applications/editor/data/utils';
import { featureCollection } from '@turf/helpers';
import { CatenaryEntity, SourceLayer, TrackSectionEntity } from 'types';
import colors from 'common/Map/Consts/colors';
import GeoJSONs, { SourcesDefinitionsIndex } from 'common/Map/Layers/GeoJSONs';
import { getEntities, getEntity } from 'applications/editor/data/api';
import { mapValues } from 'lodash';
import { Layer, Popup, Source } from 'react-map-gl';
import { getTrackRangeFeatures, isOnModeMove } from '../utils';
import { RangeEditionState, TrackState } from '../types';
import { ExtendedEditorContextType } from '../../editorContextTypes';
import EntitySumUp from '../../../components/EntitySumUp';
import { LayerType } from '../../types';

export const CatenaryEditionLayers: FC = () => {
  const { t } = useTranslation();
  const {
    renderingFingerprint,
    state: { entity, trackSectionsCache, hoveredItem, interactionState, mousePosition },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<CatenaryEntity>>;

  const { mapStyle, layersSettings, showIGNBDORTHO } = useSelector(getMap);
  const infraId = useSelector(getInfraID);
  const selection = useMemo(() => {
    // Dragging an extremity:
    if (interactionState.type === 'moveRangeExtremity')
      return [(entity.properties.track_ranges || [])[interactionState.rangeIndex].track];

    // Custom hovered element:
    if (hoveredItem?.speedSectionItemType) return [hoveredItem.track.properties.id];

    // EditorEntity hovered element:
    if (
      hoveredItem?.type === 'TrackSection' &&
      !(entity.properties.track_ranges || []).find((range) => range.track === hoveredItem.id)
    )
      return [hoveredItem.id];

    return undefined;
  }, [interactionState, hoveredItem, entity]);

  const catenariesFeature: FeatureCollection = useMemo(() => {
    const flatEntity = flattenEntity(entity);
    // generate trackRangeFeatures
    const trackRanges = entity.properties?.track_ranges || [];
    const trackRangeFeatures = trackRanges.flatMap((range, i) => {
      const trackState = trackSectionsCache[range.track];
      return trackState?.type === 'success'
        ? getTrackRangeFeatures(trackState.track, range, i, flatEntity.properties)
        : [];
    }) as Feature<LineString | Point>[];

    return featureCollection([...trackRangeFeatures]);
  }, [entity, trackSectionsCache]);

  const layersProps = useMemo(() => {
    const context = {
      sourceLayer: 'geo' as SourceLayer,
      prefix: mapStyle === 'blueprint' ? 'SCHB ' : '',
      colors: colors[mapStyle],
      signalsList: [],
      symbolsList: [],
      isEmphasized: true,
      showIGNBDORTHO,
      layersSettings,
    };
    return SourcesDefinitionsIndex.catenaries(context, 'rangeEditors/catenaries/');
  }, [mapStyle, showIGNBDORTHO, layersSettings]);

  const layers = useMemo(() => new Set(['track_sections']) as Set<LayerType>, []);

  // Here is where we handle loading the TrackSections attached to the speed section:
  useEffect(() => {
    const trackIDs = entity.properties?.track_ranges?.map((range) => range.track) || [];
    const missingTrackIDs = trackIDs.filter((id) => !trackSectionsCache[id]);

    if (missingTrackIDs.length) {
      setState((s) => ({
        ...s,
        trackSectionsCache: missingTrackIDs.reduce(
          (iter, id) => ({ ...iter, [id]: { type: 'loading' } }),
          s.trackSectionsCache
        ),
      }));

      getEntities<TrackSectionEntity>(infraId as number, missingTrackIDs, 'TrackSection').then(
        (res) => {
          setState((s) => ({
            ...s,
            trackSectionsCache: {
              ...s.trackSectionsCache,
              ...mapValues(res, (track) => ({ type: 'success', track } as TrackState)),
            },
          }));
        }
      );
    }
  }, [entity.properties?.track_ranges]);

  // Here is where we load hovered track sections that are not in ranges yet:
  useEffect(() => {
    if (hoveredItem?.type === 'TrackSection' && !trackSectionsCache[hoveredItem.id]) {
      setState((s) => ({
        ...s,
        trackSectionsCache: {
          ...s.trackSectionsCache,
          [hoveredItem.id]: { type: 'loading' },
        },
      }));

      getEntity<TrackSectionEntity>(infraId as number, hoveredItem.id, 'TrackSection').then(
        (track) => {
          setState((s) => ({
            ...s,
            trackSectionsCache: {
              ...s.trackSectionsCache,
              [hoveredItem.id]: { type: 'success', track },
            },
          }));
        }
      );
    }
  }, [hoveredItem]);

  const popUps = !isOnModeMove(interactionState.type) ? (
    <>
      {hoveredItem?.speedSectionItemType === 'TrackRangeExtremity' && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={hoveredItem.position[0]}
          latitude={hoveredItem.position[1]}
          closeButton={false}
        >
          <div>{t('Editor.tools.speed-edition.move-range-extremity')}</div>
          <EntitySumUp entity={hoveredItem.track} />
        </Popup>
      )}
      {hoveredItem?.speedSectionItemType === 'TrackRange' && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={hoveredItem.position[0]}
          latitude={hoveredItem.position[1]}
          closeButton={false}
        >
          <div>{t('Editor.tools.speed-edition.remove-track-range')}</div>
          <EntitySumUp entity={hoveredItem.track} />
        </Popup>
      )}
      {interactionState.type !== 'moveRangeExtremity' &&
        hoveredItem?.type === 'TrackSection' &&
        !(entity.properties.track_ranges || []).find((range) => range.track === hoveredItem.id) &&
        mousePosition && (
          <Popup
            className="popup"
            anchor="bottom"
            longitude={mousePosition[0]}
            latitude={mousePosition[1]}
            closeButton={false}
          >
            <div>{t('Editor.tools.speed-edition.add-track-range')}</div>
            <EntitySumUp id={hoveredItem.id} objType={hoveredItem.type} />
          </Popup>
        )}
    </>
  ) : null;

  return (
    <>
      <GeoJSONs
        colors={colors[mapStyle]}
        layers={layers}
        selection={selection}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        isEmphasized={false}
      />
      <Source type="geojson" data={catenariesFeature} key="catenaries">
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
          filter={['has', 'extremity']}
        />
      </Source>
      {popUps}
    </>
  );
};

export const CatenaryMessages: FC = () => null;

// export const CatenaryMessages: FC = () => {
//   const { t } = useTranslation();
//   const {
//     state: {
//       /* TODO */
//     },
//   } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;
//   return null;
// };
