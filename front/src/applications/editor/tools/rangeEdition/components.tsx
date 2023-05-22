import { cloneDeep, isEqual } from 'lodash';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import React, { FC, useContext, useState } from 'react';
import { BsArrowBarRight } from 'react-icons/bs';
import { AiFillSave, FaTimes, MdShowChart } from 'react-icons/all';
import { FaFlagCheckered } from 'react-icons/fa';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import EditorContext from '../../context';
import { RangeEditionState } from './types';
import {
  APPLICABLE_DIRECTIONS,
  ApplicableDirection,
  CatenaryEntity,
  EntityObjectOperationResult,
  SpeedSectionEntity,
  SpeedSectionLpvEntity,
} from '../../../../types';
import { NEW_ENTITY_ID } from '../../data/utils';
import { LoaderFill } from '../../../../common/Loader';
import EntitySumUp from '../../components/EntitySumUp';
import { save } from '../../../../reducers/editor';
import EditLPVSection from './speedSection/EditLPVSection';
import { ExtendedEditorContextType, PartialOrReducer } from '../editorContextTypes';
import { getPointAt, speedSectionIsLpv } from './utils';
import SpeedSectionMetadataForm from './speedSection/SpeedSectionMetadataForm';
import CatenaryMetadataForm from './catenary/CatenaryMetadataForm';

const DEFAULT_DISPLAYED_RANGES_COUNT = 5;

export const TrackRangesList: FC = () => {
  const {
    state: { entity, trackSectionsCache },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | CatenaryEntity>
  >;
  const { t } = useTranslation();
  const ranges = entity.properties.track_ranges || [];
  const [showAll, setShowAll] = useState(false);

  return (
    <div>
      <h4 className="pb-0">
        {/* Change translation.json into "range-edition.linked-track-sections ?" */}
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
                        // Change translation.json into "range-edition.edit-track-range-start ?"
                        title={t('Editor.tools.speed-edition.edit-track-range-start')}
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
                        // Change translation.json into "range-edition.edit-track-range-end ?"
                        title={t('Editor.tools.speed-edition.edit-track-range-end')}
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
                    <div>
                      <select
                        id="filterLevel"
                        className="form-control"
                        value={range.applicable_directions}
                        onChange={(e) => {
                          const newEntity = cloneDeep(entity);
                          const newRange = (newEntity.properties.track_ranges || [])[i];
                          newRange.applicable_directions = e.target.value as ApplicableDirection;
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
              ? // Change translation.json into "range-edition.only-show-n ?"
                t('Editor.tools.speed-edition.only-show-n', {
                  count: DEFAULT_DISPLAYED_RANGES_COUNT,
                })
              : // Change translation.json into "range-edition.show-more-ranges ?"
                t('Editor.tools.speed-edition.show-more-ranges', {
                  count: ranges.length - DEFAULT_DISPLAYED_RANGES_COUNT,
                })}
          </button>
        </div>
      )}
    </div>
  );
};

export const RangeEditionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const {
    setState,
    state: { entity, initialEntity },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | CatenaryEntity>
  >;
  const isNew = entity.properties.id === NEW_ENTITY_ID;
  const [isLoading, setIsLoading] = useState(false);
  const isLPV = speedSectionIsLpv(entity as SpeedSectionEntity);

  const updateSpeedSectionExtensions = (
    extensions: SpeedSectionEntity['properties']['extensions']
  ) => {
    const newEntity = cloneDeep(entity) as SpeedSectionEntity;
    newEntity.properties.extensions = extensions;
    setState({
      entity: newEntity,
    });
  };

  let saveMessage;
  if (entity.objType === 'SpeedSection') {
    saveMessage = isNew
      ? t('Editor.tools.speed-edition.save-new-speed-section')
      : t('Editor.tools.speed-edition.save-existing-speed-section');
  } else {
    saveMessage = isNew
      ? t('Editor.tools.catenary-edition.save-new-catenary')
      : t('Editor.tools.catenary-edition.save-existing-catenary');
  }

  return (
    <div>
      <legend>
        {t(`Editor.obj-types.${entity.objType === 'SpeedSection' ? 'SpeedSection' : 'Catenary'}`)}
      </legend>
      <div className="my-4">
        <button
          type="button"
          className="btn btn-primary w-100 text-wrap"
          disabled={isLoading || isEqual(entity, initialEntity)}
          onClick={async () => {
            setIsLoading(true);

            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const res: any = await dispatch(
                save(
                  !isNew
                    ? {
                        update: [
                          {
                            source: initialEntity,
                            target: entity,
                          },
                        ],
                      }
                    : { create: [entity] }
                )
              );
              const operation = res[0] as EntityObjectOperationResult;
              const { id } = operation.railjson;
              setIsLoading(false);

              const savedEntity =
                id && id !== entity.properties.id
                  ? {
                      ...entity,
                      properties: { ...entity.properties, id: `${id}` },
                    }
                  : entity;
              setState({
                entity: cloneDeep(savedEntity),
                initialEntity: cloneDeep(savedEntity),
              });
            } catch (e: unknown) {
              setIsLoading(false);
            }
          }}
        >
          <AiFillSave className="mr-2" />
          {saveMessage}
        </button>
      </div>
      {initialEntity.objType === 'SpeedSection' ? (
        <SpeedSectionMetadataForm />
      ) : (
        <CatenaryMetadataForm />
      )}
      <hr />
      {initialEntity.objType === 'SpeedSection' && (
        <>
          <div>
            <div className="d-flex">
              <CheckboxRadioSNCF
                type="checkbox"
                id="is-lpv-checkbox"
                name="is-lpv-checkbox"
                checked={isLPV}
                label={t('Editor.tools.speed-edition.toggle-lpv')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  let newExtension: SpeedSectionEntity['properties']['extensions'] = {
                    lpv_sncf: null,
                  };
                  if (e.target.checked) {
                    const firstRange = (entity.properties?.track_ranges || [])[0];
                    if (!firstRange) return;
                    newExtension = {
                      lpv_sncf: initialEntity.properties?.extensions?.lpv_sncf || {
                        announcement: [],
                        r: [],
                        z: {
                          angle_sch: 0,
                          angle_geo: 0,
                          position: firstRange.begin,
                          side: 'LEFT',
                          track: firstRange.track,
                          type: 'Z',
                          value: null,
                        },
                      },
                    };
                  }
                  updateSpeedSectionExtensions(newExtension);
                }}
              />
            </div>
            {isLPV && (
              <EditLPVSection
                entity={entity as SpeedSectionLpvEntity}
                setState={
                  setState as (
                    stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>
                  ) => void
                }
              />
            )}
          </div>
          <hr />
        </>
      )}
      <TrackRangesList />
    </div>
  );
};
