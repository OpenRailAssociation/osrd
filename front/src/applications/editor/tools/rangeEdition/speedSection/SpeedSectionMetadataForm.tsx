import React, { FC, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import EditorContext from 'applications/editor/context';
import { SpeedSectionEntity } from 'types';
import { AiOutlinePlusCircle, FaTimes, MdSpeed } from 'react-icons/all';
import { cloneDeep, isEmpty, map, mapKeys, omit } from 'lodash';
import { ExtendedEditorContextType } from '../../editorContextTypes';
import { RangeEditionState } from '../types';
import SpeedInput from './SpeedInput';
import { kmhToMs } from '../utils';

const SpeedSectionMetadataForm: FC = () => {
  const { t } = useTranslation();
  const {
    state: { entity },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<SpeedSectionEntity>>;

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
        <button
          type="button"
          className="btn btn-secondary w-100 text-wrap small mb-2"
          onClick={async () => {
            const newEntity = cloneDeep(entity);
            newEntity.properties.speed_limit_by_tag = newEntity.properties.speed_limit_by_tag || {};
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
      </form>
    </div>
  );
};

export default SpeedSectionMetadataForm;
