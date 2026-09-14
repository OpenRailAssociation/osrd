import { useContext, useEffect, useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import EntityError from 'applications/editor/components/EntityError';
import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useInfraID } from 'common/osrdContext';
import { useAppDispatch } from 'store';
import { save } from 'reducers/editor/thunkActions';

import type { OpEditionState, OpEntity } from '../types';
import { getOpEditionState } from '../utils';

const OpEditionPanel = () => {
  const { t } = useTranslation('Editor.tools.op-edition');
  const infraID = useInfraID();
  const dispatch = useAppDispatch();

  const { state, setState, isFormSubmited, setIsFormSubmited } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<OpEditionState>;

  const isNew = state.entity.properties.id === NEW_ENTITY_ID;

  const saveEntity = useCallback(
    async (entity: OpEntity, previous?: OpEntity) => {
      const payload = previous
        ? {
            update: [
              {
                source: previous,
                target: entity,
              },
            ],
          }
        : {
            create: [entity],
          };

      const result = await dispatch(save(infraID, payload));
      setState(getOpEditionState({
        ...entity,
        properties: result && result[0] ? result[0].railjson : entity.properties,
      } as OpEntity));
    },
    [infraID, dispatch, setState]
  );

  /**
   * When clicking on the save button in the toolbar
   */
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited && state.entity) {
      setIsFormSubmited(false);
      saveEntity(
        state.entity,
        state.entity.properties.id !== NEW_ENTITY_ID ? state.initialEntity : undefined
      );
    }
  }, [isFormSubmited, saveEntity, state.entity, state.initialEntity, setIsFormSubmited]);

  return (
    <div className="position-relative">
      <legend>
        {isNew ? t('create-op') : t('edit-op')}
      </legend>

      <div className="form-group">
        <label htmlFor="op-name">
          {t('fields.name.title')}
          <span className="required">*</span>
        </label>
        <p className="field-description">{t('fields.name.description')}</p>
        <InputSNCF
          id="op-name"
          type="text"
          value={state.entity.properties.name}
          inputProps={{ required: true }}
          whiteBG
          focus
          onChange={(event) => {
            setState((prev) => ({
              ...prev,
              isComplete: Boolean(event.target.value),
              entity: {
                ...prev.entity,
                properties: {
                  ...prev.entity.properties,
                  name: event.target.value,
                }
              },
            }));
          }}
        />
      </div>

      {!isNew && <EntityError className="my-2" entity={state.entity} />}
    </div>
  );
};

export default OpEditionPanel;
