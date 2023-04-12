import { mapValues, without, cloneDeep } from 'lodash';
import { useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { featureCollection } from '@turf/helpers';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';
import React, { FC, useContext, useEffect, useMemo, useState } from 'react';
import { BsArrowBarRight } from 'react-icons/bs';
import { FaTimes, MdShowChart } from 'react-icons/all';
import { FaFlagCheckered } from 'react-icons/fa';

import EditorContext from '../../context';
import { SpeedSectionEditionState, TrackState } from './types';
import { ExtendedEditorContextType } from '../types';
import colors from '../../../../common/Map/Consts/colors';
import GeoJSONs, { SourcesDefinitionsIndex } from '../../../../common/Map/Layers/GeoJSONs';
import { getMap } from '../../../../reducers/map/selectors';
import { TrackSectionEntity } from '../../../../types';
import { getEntities } from '../../data/api';
import { getInfraID } from '../../../../reducers/osrdconf/selectors';
import { getTrackRangeFeatures } from './utils';
import { flattenEntity } from '../../data/utils';
import Loader from '../../../../common/Loader';
import EntitySumUp from '../../components/EntitySumUp';

const DEFAULT_DISPLAYED_RANGES_COUNT = 5;

export const TrackRangesList: FC = () => {
  const {
    state: { entity, trackSectionsCache },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;
  const { t } = useTranslation();
  const ranges = entity.properties.track_ranges || [];
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      <ul className="list-unstyled">
        {(showAll ? ranges : ranges.slice(0, DEFAULT_DISPLAYED_RANGES_COUNT)).map((range, i) => {
          const trackState = trackSectionsCache[range.track];

          return (
            <li
              key={i}
              className="mb-4 d-flex flex-row align-items-center"
              onMouseEnter={() => setState({ hoveredTrackSection: range.track })}
              onMouseLeave={() => setState({ hoveredTrackSection: null })}
            >
              {(!trackState || trackState.type === 'loading') && <Loader />}
              {trackState?.type === 'success' && (
                <>
                  <div className="flex-shrink-0 mr-3 d-flex flex-column">
                    <small>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm px-2 mb-1"
                        title={t('Editor.tools.speed-edition.edit-track-range-start')}
                        onClick={() => {
                          setState({
                            interactionState: {
                              type: 'movePoint',
                              rangeIndex: i,
                              extremity: 'BEGIN',
                            },
                          });
                        }}
                      >
                        <BsArrowBarRight />
                      </button>
                    </small>
                    <small>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm px-2 mb-1"
                        title={t('Editor.tools.speed-edition.edit-track-range-end')}
                        onClick={() => {
                          setState({
                            interactionState: {
                              type: 'movePoint',
                              rangeIndex: i,
                              extremity: 'END',
                            },
                          });
                        }}
                      >
                        <FaFlagCheckered />
                      </button>
                    </small>
                    <small>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm px-2"
                        title={t('common.delete')}
                        onClick={() => {
                          const newEntity = cloneDeep(entity);
                          newEntity.properties.track_ranges?.splice(i, 1);
                          setState({ entity: newEntity });
                        }}
                      >
                        <FaTimes />
                      </button>
                    </small>
                  </div>
                  <div className="flex-grow-1 flex-shrink-1">
                    <EntitySumUp entity={trackState.track} />
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {ranges.length > DEFAULT_DISPLAYED_RANGES_COUNT && (
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-secondary w-100 text-wrap"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? t('Editor.tools.speed-edition.only-show-n', {
                  count: DEFAULT_DISPLAYED_RANGES_COUNT,
                })
              : t('Editor.tools.speed-edition.show-more-ranges', {
                  count: ranges.length - DEFAULT_DISPLAYED_RANGES_COUNT,
                })}
          </button>
        </div>
      )}
      <div className="mt-2">
        <button
          type="button"
          className="btn btn-primary w-100"
          onClick={() => {
            setState({
              interactionState: {
                type: 'addTrackSection',
              },
            });
          }}
        >
          {t('Editor.tools.speed-edition.add-track-range')}
        </button>
      </div>
    </>
  );
};

export const SpeedSectionEditionLeftPanel: FC = () => {
  const {
    state: { entity, trackSectionsCache },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;
  const { t } = useTranslation();

  return (
    <div>
      <legend>{t('Editor.obj-types.SpeedSection')}</legend>
      <h4 className="pb-0">
        <MdShowChart className="me-1" /> {t('Editor.tools.speed-edition.linked-track-sections')}
      </h4>
      <TrackRangesList />
    </div>
  );
};

export const SpeedSectionEditionLayers: FC = () => {
  const {
    renderingFingerprint,
    editorState: { editorLayers },
    state: { entity, trackSectionsCache },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;
  const { mapStyle, layersSettings, showIGNBDORTHO } = useSelector(getMap);
  const infraId = useSelector(getInfraID);

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

  // Here is were we handle loading the TrackSections attached to the speed section:
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
