import React, { useContext, useState } from 'react';

import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BsArrowBarRight } from 'react-icons/bs';
import { FaFlagCheckered, FaTimes } from 'react-icons/fa';
import { MdShowChart } from 'react-icons/md';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { APPLICABLE_DIRECTIONS } from 'applications/editor/tools/rangeEdition/consts';
import type {
  ApplicableDirection,
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import { getPointAt } from 'applications/editor/tools/rangeEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { LoaderFill } from 'common/Loaders';

const DEFAULT_DISPLAYED_RANGES_COUNT = 5;

const TrackRangesList = () => {
  const {
    state: { entity, trackSectionsCache },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;
  const { t } = useTranslation();
  const ranges = entity.properties.track_ranges || [];
  const [showAll, setShowAll] = useState(false);

  return (
    <div>
      <h4 className="pb-0">
        <MdShowChart className="me-1" /> {t('Editor.tools.range-edition.linked-track-sections')}
      </h4>
      {ranges.length === 0 ? (
        <p className="text-muted mt-3 text-center">
          {t('Editor.tools.range-edition.empty-linked-track-section')}
        </p>
      ) : (
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
                          aria-label={t('Editor.tools.range-edition.edit-track-range-start')}
                          title={t('Editor.tools.range-edition.edit-track-range-start')}
                          onClick={() => {
                            setState({
                              hoveredItem: null,
                              interactionState: {
                                type: 'moveRangeExtremity',
                                rangeIndex: i,
                                extremity: 'BEGIN',
                              },
                            });
                          }}
                          onMouseLeave={() => setState({ hoveredItem: null })}
                          onMouseEnter={() =>
                            setState({
                              hoveredItem: {
                                itemType: 'TrackRangeExtremity',
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
                          aria-label={t('Editor.tools.range-edition.edit-track-range-end')}
                          title={t('Editor.tools.range-edition.edit-track-range-end')}
                          onClick={() => {
                            setState({
                              hoveredItem: null,
                              interactionState: {
                                type: 'moveRangeExtremity',
                                rangeIndex: i,
                                extremity: 'END',
                              },
                            });
                          }}
                          onMouseLeave={() => setState({ hoveredItem: null })}
                          onMouseEnter={() =>
                            setState({
                              hoveredItem: {
                                itemType: 'TrackRangeExtremity',
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
                          aria-label={t('common.delete')}
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
                                itemType: 'TrackRange',
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
                      {entity.objType !== 'Electrification' && (
                        <div>
                          <select
                            id="filterLevel"
                            className="form-control"
                            value={range.applicable_directions}
                            onChange={(e) => {
                              const newEntity = cloneDeep(entity);
                              const newRange = (newEntity.properties.track_ranges || [])[i];
                              newRange.applicable_directions = e.target
                                .value as ApplicableDirection;
                              setState({ entity: newEntity, hoveredItem: null });
                            }}
                          >
                            {APPLICABLE_DIRECTIONS.map((direction) => (
                              <option key={direction} value={direction}>
                                {t(`Editor.directions.${direction}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {ranges.length > DEFAULT_DISPLAYED_RANGES_COUNT && (
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-secondary w-100 text-wrap"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? t('Editor.tools.range-edition.only-show-n', {
                  count: DEFAULT_DISPLAYED_RANGES_COUNT,
                })
              : t('Editor.tools.range-edition.show-more-ranges', {
                  count: ranges.length - DEFAULT_DISPLAYED_RANGES_COUNT,
                })}
          </button>
        </div>
      )}
    </div>
  );
};

export default TrackRangesList;
