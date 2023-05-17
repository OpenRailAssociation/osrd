import { cloneDeep, isEqual, map, isEmpty, mapKeys, omit } from 'lodash';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import React, { FC, useContext, useState } from 'react';
import { BsArrowBarRight } from 'react-icons/bs';
import { AiFillSave, AiOutlinePlusCircle, FaTimes, GiElectric, MdShowChart } from 'react-icons/all';
import { FaFlagCheckered } from 'react-icons/fa';
import { MdSpeed } from 'react-icons/md';

import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
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
import { ExtendedEditorContextType } from '../editorContextTypes';
import SpeedInput from './speedSection/SpeedInput';
import { getPointAt, kmhToMs, speedSectionIsLpv } from './utils';

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
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | CatenaryEntity>
  >;

  return (
    <div>
      <h4 className="pb-0">
        {entity.objType === 'SpeedSection' ? (
          <MdSpeed className="me-1" />
        ) : (
          <GiElectric className="me-1" />
        )}{' '}
        {t(
          `Editor.tools.${
            entity.objType === 'SpeedSection'
              ? 'speed-edition.speed-limits'
              : 'catenary-edition.catenaries'
          }`
        )}
      </h4>
      {/* The following tag is here to mimick other tools' forms style: */}
      <form className="rjsf" onSubmit={(e) => e.preventDefault()}>
        {entity.objType === 'SpeedSection' ? (
          <div className="form-group field field-string mb-2">
            <label className="control-label" htmlFor="speed-section.main-limit">
              {t(
                `Editor.tools.${
                  entity.objType === 'SpeedSection'
                    ? 'speed-edition.main-speed-limit'
                    : 'catenary-edition.catenary-default'
                }`
              )}
            </label>
            <div className="d-flex flex-row align-items-center">
              <SpeedInput
                className="form-control flex-grow-1 flex-shrink-1"
                id="speed-section.main-limit"
                placeholder=""
                msSpeed={entity.properties.speed_limit || undefined}
                onChange={(newMsSpeed) => {
                  const newEntity = cloneDeep(entity);
                  newEntity.properties.speed_limit = newMsSpeed;
                  setState({ entity: newEntity });
                }}
              />
              <span className="text-muted ml-2">km/h</span>
            </div>
          </div>
        ) : (
          <div className="form-group field field-string mb-2">
            <label className="control-label" htmlFor="catenary.default">
              {t('Editor.tools.catenary-edition.catenary-default')}
            </label>
            <div className="d-flex flex-row align-items-center">
              <InputSNCF id="catenary.default" type="text" />
            </div>
          </div>
        )}
        {entity.objType === 'SpeedSection' && !isEmpty(entity.properties.speed_limit_by_tag) && (
          <div className="control-label mb-1">
            {t('Editor.tools.speed-edition.additional-speed-limit')}
          </div>
        )}
        {entity.objType === 'SpeedSection' &&
          map(entity.properties.speed_limit_by_tag || {}, (value, key) => (
            <div className="form-group field field-string">
              <div className="d-flex flex-row align-items-center">
                <input
                  className="form-control flex-grow-2 flex-shrink-1 mr-2"
                  placeholder=""
                  type="text"
                  value={key}
                  onChange={(e) => {
                    const newEntity = cloneDeep(entity);
                    const newKey = e.target.value;
                    newEntity.properties.speed_limit_by_tag = mapKeys(
                      newEntity.properties.speed_limit_by_tag || {},
                      (_v, k) => (k === key ? newKey : k)
                    );
                    setState({ entity: newEntity });
                  }}
                />
                <SpeedInput
                  className="form-control flex-shrink-0 px-2"
                  style={{ width: '5em' }}
                  placeholder=""
                  msSpeed={value}
                  onChange={(newMsSpeed) => {
                    const newEntity = cloneDeep(entity);
                    newEntity.properties.speed_limit_by_tag =
                      newEntity.properties.speed_limit_by_tag || {};
                    newEntity.properties.speed_limit_by_tag[key] = newMsSpeed;
                    setState({ entity: newEntity });
                  }}
                />
                <span className="text-muted ml-2">km/h</span>
                <small>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-2 ml-2"
                    title={t('commons.delete')}
                    onClick={() => {
                      const newEntity = cloneDeep(entity);
                      newEntity.properties.speed_limit_by_tag = omit(
                        newEntity.properties.speed_limit_by_tag || {},
                        key
                      );
                      setState({ entity: newEntity });
                    }}
                  >
                    <FaTimes />
                  </button>
                </small>
              </div>
            </div>
          ))}
        {entity.objType === 'SpeedSection' ? (
          <button
            type="button"
            className="btn btn-secondary w-100 text-wrap small mb-2"
            onClick={async () => {
              const newEntity = cloneDeep(entity);
              newEntity.properties.speed_limit_by_tag =
                newEntity.properties.speed_limit_by_tag || {};
              let key = t('Editor.tools.speed-edition.new-tag');
              let i = 1;
              if (newEntity.properties.speed_limit_by_tag[key]) {
                while (newEntity.properties.speed_limit_by_tag[`${key} ${i}`]) i += 1;
                key += ` ${i}`;
              }
              newEntity.properties.speed_limit_by_tag[key] = kmhToMs(80);
              setState({ entity: newEntity });
            }}
          >
            <AiOutlinePlusCircle className="mr-2" />
            {t('Editor.tools.speed-edition.add-new-speed-limit')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary w-100 text-wrap small mb-2"
            onClick={async () => {
              const newEntity = cloneDeep(entity);
              setState({ entity: newEntity });
            }}
          >
            <AiOutlinePlusCircle className="mr-2" />
            {t('Editor.tools.catenary-edition.add-new-catenary')}
          </button>
        )}
      </form>
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
      <MetadataForm />
      <hr />
      {initialEntity.objType === 'SpeedSection' && (
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
          {isLPV && <EditLPVSection entity={entity as SpeedSectionLpvEntity} setState={setState} />}
        </div>
      )}
      <hr />
      <TrackRangesList />
    </div>
  );
};
