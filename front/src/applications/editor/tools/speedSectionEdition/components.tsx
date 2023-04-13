import { mapValues, cloneDeep } from 'lodash';
import { useSelector } from 'react-redux';
import { Layer, Popup, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { featureCollection } from '@turf/helpers';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';
import React, { FC, useContext, useEffect, useMemo, useState } from 'react';
import { BsArrowBarRight } from 'react-icons/bs';
import { FaTimes, MdShowChart } from 'react-icons/all';
import { FaFlagCheckered } from 'react-icons/fa';
import { MdSpeed } from 'react-icons/md';

import EditorContext from '../../context';
import { SpeedSectionEditionState, TrackState } from './types';
import { ExtendedEditorContextType, LayerType } from '../types';
import colors from '../../../../common/Map/Consts/colors';
import GeoJSONs, { SourcesDefinitionsIndex } from '../../../../common/Map/Layers/GeoJSONs';
import { getMap } from '../../../../reducers/map/selectors';
import { TrackSectionEntity } from '../../../../types';
import { getEntities } from '../../data/api';
import { getInfraID } from '../../../../reducers/osrdconf/selectors';
import { getPointAt, getTrackRangeFeatures } from './utils';
import { flattenEntity } from '../../data/utils';
import { LoaderFill } from '../../../../common/Loader';
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
    <div>
      <h4 className="pb-0">
        <MdShowChart className="me-1" /> {t('Editor.tools.speed-edition.linked-track-sections')}
      </h4>
      <ul className="list-unstyled">
        {(showAll ? ranges : ranges.slice(0, DEFAULT_DISPLAYED_RANGES_COUNT)).map((range, i) => {
          const trackState = trackSectionsCache[range.track];

          return (
            <li key={i} className="mb-4 d-flex flex-row align-items-center">
              {(!trackState || trackState.type === 'loading') && (
                <div className="position-relative w-100" style={{ height: 50 }}>
                  <LoaderFill className="bg-transparent" />
                </div>
              )}
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
                            hoveredItem: null,
                            interactionState: {
                              type: 'movePoint',
                              rangeIndex: i,
                              extremity: 'BEGIN',
                            },
                          });
                        }}
                        onMouseLeave={() => setState({ hoveredItem: null })}
                        onMouseEnter={() =>
                          setState({
                            hoveredItem: {
                              speedSectionItemType: 'TrackRangeExtremity',
                              track: trackState.track,
                              position: getPointAt(trackState.track, range.begin),
                              extremity: 'BEGIN',
                            },
                          })
                        }
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
                            hoveredItem: null,
                            interactionState: {
                              type: 'movePoint',
                              rangeIndex: i,
                              extremity: 'END',
                            },
                          });
                        }}
                        onMouseLeave={() => setState({ hoveredItem: null })}
                        onMouseEnter={() =>
                          setState({
                            hoveredItem: {
                              speedSectionItemType: 'TrackRangeExtremity',
                              track: trackState.track,
                              position: getPointAt(trackState.track, range.end),
                              extremity: 'END',
                            },
                          })
                        }
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
                          setState({ entity: newEntity, hoveredItem: null });
                        }}
                        onMouseLeave={() => setState({ hoveredItem: null })}
                        onMouseEnter={() =>
                          setState({
                            hoveredItem: {
                              speedSectionItemType: 'TrackRange',
                              track: trackState.track,
                              position: getPointAt(
                                trackState.track,
                                trackState.track.properties.length / 2
                              ),
                            },
                          })
                        }
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
    </div>
  );
};

export const MetadataForm: FC = () => {
  const { t } = useTranslation();
  const {
    state: { entity },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;

  return (
    <div>
      <h4 className="pb-0">
        <MdSpeed className="me-1" /> {t('Editor.tools.speed-edition.speed-limits')}
      </h4>
      {/* The following tag is here to mimick other tools' forms style: */}
      <form className="rjsf" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group field field-string">
          <label className="control-label" htmlFor="speed-section.main-limit">
            {t('Editor.tools.speed-edition.main-speed-limit')}
          </label>
          <input
            className="form-control"
            id="speed-section.main-limit"
            placeholder=""
            type="number"
            min={0}
            value={entity.properties.speed_limit || ''}
            onChange={(e) => {
              const newEntity = cloneDeep(entity);
              const value = parseFloat(e.target.value);
              newEntity.properties.speed_limit = !isNaN(value) ? value : undefined;
              setState({ entity: newEntity });
            }}
          />
        </div>
      </form>
    </div>
  );
};

export const SpeedSectionEditionLeftPanel: FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <legend>{t('Editor.obj-types.SpeedSection')}</legend>
      <MetadataForm />
      <TrackRangesList />
    </div>
  );
};

export const SpeedSectionEditionLayers: FC = () => {
  const { t } = useTranslation();
  const {
    renderingFingerprint,
    state: { entity, trackSectionsCache, hoveredItem, interactionState, mousePosition },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<SpeedSectionEditionState>;
  const { mapStyle, layersSettings, showIGNBDORTHO } = useSelector(getMap);
  const infraId = useSelector(getInfraID);
  const selection = useMemo(() => {
    // Dragging an extremity:
    if (interactionState.type === 'movePoint')
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

  const speedSectionsFeature: FeatureCollection = useMemo(() => {
    const flatEntity = flattenEntity(entity);
    const trackRanges = entity.properties?.track_ranges || [];
    return featureCollection(
      trackRanges.flatMap((range, i) => {
        const trackState = trackSectionsCache[range.track];
        return trackState?.type === 'success'
          ? getTrackRangeFeatures(trackState.track, range, i, flatEntity.properties)
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

  return (
    <>
      <GeoJSONs
        colors={colors[mapStyle]}
        layers={layers}
        selection={selection}
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
          filter={['has', 'extremity']}
        />
      </Source>
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
      {interactionState.type !== 'movePoint' &&
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
