import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsArrowBarRight } from 'react-icons/bs';
import { MdShowChart } from 'react-icons/md';
import { FaFlagCheckered, FaTimes } from 'react-icons/fa';
import { cloneDeep } from 'lodash';

import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import EntityError from 'applications/editor/components/EntityError';
import EntitySumUp from 'applications/editor/components/EntitySumUp';
import type { RangeEditionState } from 'applications/editor/tools/rangeEdition/types';
import { getPointAt, speedSectionIsPsl } from 'applications/editor/tools/rangeEdition/utils';
import EditPSLSection from 'applications/editor/tools/rangeEdition/speedSection/EditPSLSection';
import ElectrificationMetadataForm from 'applications/editor/tools/rangeEdition/electrification/ElectrificationMetadataForm';
import SpeedSectionMetadataForm from 'applications/editor/tools/rangeEdition/speedSection/SpeedSectionMetadataForm';
import type {
  ExtendedEditorContextType,
  PartialOrReducer,
} from 'applications/editor/tools/editorContextTypes';

import type {
  ApplicableDirection,
  ElectrificationEntity,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
} from 'types';
import { APPLICABLE_DIRECTIONS } from 'types';

import { LoaderFill } from 'common/Loaders';
import { useInfraID } from 'common/osrdContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';

const DEFAULT_DISPLAYED_RANGES_COUNT = 5;

export const TrackRangesList = () => {
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

export const RangeEditionLeftPanel = () => {
  const { t } = useTranslation();
  const {
    setState,
    state: { entity, initialEntity, trackSectionsCache },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;

  const isNew = entity.properties.id === NEW_ENTITY_ID;
  const isPSL = speedSectionIsPsl(entity as SpeedSectionEntity);
  const infraID = useInfraID();

  const { data: voltages } = osrdEditoastApi.useGetInfraByIdVoltagesQuery(
    {
      id: infraID as number,
    },
    { skip: !infraID }
  );

  const updateSpeedSectionExtensions = (
    extensions: SpeedSectionEntity['properties']['extensions']
  ) => {
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    newEntity.properties.extensions = extensions;
    setState({
      entity: newEntity,
    });
  };

  return (
    <div>
      <legend className="mb-4">
        {t(
          `Editor.obj-types.${
            entity.objType === 'SpeedSection' ? 'SpeedSection' : 'Electrification'
          }`
        )}
      </legend>
      {initialEntity.objType === 'SpeedSection' ? (
        <SpeedSectionMetadataForm />
      ) : (
        voltages && <ElectrificationMetadataForm voltages={voltages} />
      )}
      <hr />
      {initialEntity.objType === 'SpeedSection' && (
        <>
          <div>
            <div className="d-flex">
              <CheckboxRadioSNCF
                type="checkbox"
                id="is-psl-checkbox"
                name="is-psl-checkbox"
                checked={isPSL}
                disabled={entity.properties.track_ranges?.length === 0}
                label={t('Editor.tools.speed-edition.toggle-psl')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  let newExtension: SpeedSectionEntity['properties']['extensions'] = {
                    psl_sncf: null,
                  };
                  if (e.target.checked) {
                    const firstRange = (entity.properties?.track_ranges || [])[0];
                    if (!firstRange) return;
                    newExtension = {
                      psl_sncf: initialEntity.properties?.extensions?.psl_sncf || {
                        announcement: [],
                        r: [],
                        z: {
                          angle_sch: 0,
                          angle_geo: 0,
                          position: firstRange.begin,
                          side: 'LEFT',
                          track: firstRange.track,
                          type: 'Z',
                          value: '',
                          kp: '',
                        },
                      },
                    };
                  }
                  updateSpeedSectionExtensions(newExtension);
                }}
              />
            </div>
            {entity.properties.track_ranges?.length === 0 && (
              <p className="mt-3 font-size-1">{t('Editor.tools.speed-edition.toggle-psl-help')}</p>
            )}
            {isPSL && (
              <EditPSLSection
                entity={entity as SpeedSectionPslEntity}
                setState={
                  setState as (
                    stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>
                  ) => void
                }
                trackSectionsCache={trackSectionsCache}
              />
            )}
          </div>
          <hr />
        </>
      )}
      <TrackRangesList />

      {!isNew && <EntityError className="mt-1" entity={entity} />}
    </div>
  );
};
