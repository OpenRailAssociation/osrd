import React, { FC, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import EditorContext from 'applications/editor/context';
import { SpeedSectionEntity } from 'types';
import { AiOutlinePlusCircle, FaTimes, MdSpeed } from 'react-icons/all';
import { cloneDeep, isEmpty, map, mapKeys, omit } from 'lodash';
import { ExtendedEditorContextType } from '../../editorContextTypes';
import { RangeEditionState } from '../types';
import SpeedInput from './SpeedInput';

const getNewSpeedLimitTag = (
  speedLimitsByTag: Record<string, number | undefined>,
  defaultTag: string
) => {
  let newSpeedLimitTag = defaultTag;
  let i = 1;
  if (speedLimitsByTag[newSpeedLimitTag]) {
    while (speedLimitsByTag[`${newSpeedLimitTag} ${i}`]) i += 1;
    newSpeedLimitTag += ` ${i}`;
  }
  return newSpeedLimitTag;
};

const SpeedSectionMetadataForm: FC = () => {
  const { t } = useTranslation();
  const {
    state: { entity },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<SpeedSectionEntity>>;

  const addSpeedSectionButtonIsDisabled = useMemo(() => {
    const { speed_limit_by_tag } = entity.properties;
    if (speed_limit_by_tag) {
      const speed_limits = Object.values(speed_limit_by_tag);
      const has_undefined_speed_limit = speed_limits.some(
        (speed_limit) => speed_limit === undefined || speed_limit === 0
      );
      return has_undefined_speed_limit;
    }
    return false;
  }, [entity]);

  return (
    <div>
      <h4 className="pb-0">
        <MdSpeed className="me-1" /> {t('Editor.tools.speed-edition.speed-limits')}
      </h4>
      {/* The following tag is here to mimick other tools' forms style: */}
      <form className="rjsf" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group field field-string mb-2">
          <label className="control-label" htmlFor="speed-section.main-limit">
            {t('Editor.tools.speed-edition.main-speed-limit')}
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
        {!isEmpty(entity.properties.speed_limit_by_tag) && (
          <div className="control-label mb-1">
            {t('Editor.tools.speed-edition.additional-speed-limit')}
          </div>
        )}
        {map(entity.properties.speed_limit_by_tag || {}, (value, key) => (
          <div className="form-group field field-string">
            <div className="d-flex flex-row align-items-center">
              <input
                className="form-control flex-grow-2 flex-shrink-1 mr-2 px-2"
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
        <button
          type="button"
          className="btn btn-secondary w-100 text-wrap small mb-2"
          onClick={async () => {
            const newEntity = cloneDeep(entity);
            newEntity.properties.speed_limit_by_tag = newEntity.properties.speed_limit_by_tag || {};
            const newSpeedLimitTag = getNewSpeedLimitTag(
              newEntity.properties.speed_limit_by_tag,
              t('Editor.tools.speed-edition.new-tag')
            );
            newEntity.properties.speed_limit_by_tag[newSpeedLimitTag] = undefined;
            setState({ entity: newEntity });
          }}
          disabled={addSpeedSectionButtonIsDisabled}
        >
          <AiOutlinePlusCircle className="mr-2" />
          {t('Editor.tools.speed-edition.add-new-speed-limit')}
        </button>
      </form>
    </div>
  );
};

export default SpeedSectionMetadataForm;
