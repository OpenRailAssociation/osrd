import React, { type FC, useContext, useEffect, useMemo, useState } from 'react';

import { cloneDeep, isEmpty, isEqual, map, size } from 'lodash';
import { useTranslation } from 'react-i18next';
import { AiOutlinePlusCircle } from 'react-icons/ai';
import { FaTimes } from 'react-icons/fa';
import { MdSpeed } from 'react-icons/md';
import nextId from 'react-id-generator';

import EditorContext from 'applications/editor/context';
import type {
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

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
    state: { entity, error },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<RangeEditionState<SpeedSectionEntity>>;

  const [tagSpeedLimits, setTagSpeedLimits] = useState<
    { id: string; tag: string; value?: number }[]
  >(map(entity.properties.speed_limit_by_tag, (value, tag) => ({ tag, value, id: nextId() })));

  const tagCounts = useMemo(
    () =>
      tagSpeedLimits.reduce(
        (iter: Record<string, number>, { tag }) => ({ ...iter, [tag]: (iter[tag] || 0) + 1 }),
        {}
      ),
    [tagSpeedLimits]
  );

  useEffect(() => {
    const newState: Partial<RangeEditionState<SpeedSectionEntity>> = {};
    const newSpeedLimitByTags = tagSpeedLimits.reduce(
      (iter, { tag, value }) => ({ ...iter, [tag]: value }),
      {}
    );
    if (!isEqual(newSpeedLimitByTags, entity.properties.speed_limit_by_tag)) {
      const newEntity = cloneDeep(entity);
      newEntity.properties.speed_limit_by_tag = newSpeedLimitByTags;
      newState.entity = newEntity;
    }

    const speedLimitsByTag = entity.properties.speed_limit_by_tag || {};
    let newError: string | undefined;
    if (Object.values(speedLimitsByTag).some((limit) => !limit)) newError = 'empty-limit';
    if (size(speedLimitsByTag) !== tagSpeedLimits.length) newError = 'duplicate-tags';
    if (newError !== error) newState.error = newError;

    if (!isEmpty(newState)) setState(newState);
  }, [tagSpeedLimits, entity, error]);

  return (
    <div>
      <h4 className="pb-0">
        <MdSpeed className="me-1" /> {t('Editor.tools.speed-edition.speed-limits')}
      </h4>
      {/* The following tag is here to mimic other tools' forms style: */}
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
        {tagSpeedLimits.map(({ id, tag, value }, currentIndex) => (
          <div key={id} className="form-group field field-string">
            <div className="d-flex flex-row align-items-center">
              <input
                required
                className="form-control flex-grow-2 flex-shrink-1 mr-2 px-2"
                placeholder=""
                type="text"
                value={tag}
                pattern={
                  // Insert an invalid pattern to force the error appearance when tag is redundant
                  tagCounts[tag] && tagCounts[tag] > 1 ? `not ${tag}` : undefined
                }
                onChange={(e) => {
                  const newKey = e.target.value;
                  setTagSpeedLimits((state) =>
                    state.map((pair, i) => (i === currentIndex ? { ...pair, tag: newKey } : pair))
                  );
                }}
              />
              <SpeedInput
                className="form-control flex-shrink-0 px-2"
                style={{ width: '5em' }}
                required
                placeholder=""
                msSpeed={value}
                onChange={(newMsSpeed) => {
                  setTagSpeedLimits((state) =>
                    state.map((pair, i) =>
                      i === currentIndex ? { ...pair, value: newMsSpeed } : pair
                    )
                  );
                }}
              />
              <span className="text-muted ml-2">km/h</span>
              <small>
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-2 ml-2"
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                  onClick={() => {
                    setTagSpeedLimits((state) => state.filter((_, i) => i !== currentIndex));
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
            setTagSpeedLimits((state) =>
              state.concat({
                id: nextId(),
                tag: getNewSpeedLimitTag(
                  entity.properties.speed_limit_by_tag || {},
                  t('Editor.tools.speed-edition.new-tag')
                ),
                value: undefined,
              })
            );
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
