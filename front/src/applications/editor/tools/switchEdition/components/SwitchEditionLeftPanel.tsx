import React, { useContext, useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';

import EditorForm from 'applications/editor/components/EditorForm';
import EntityError from 'applications/editor/components/EntityError';
import EditorContext from 'applications/editor/context';
import type {
  SwitchEditionState,
  SwitchEntity,
} from 'applications/editor/tools/switchEdition/types';
import useSwitch from 'applications/editor/tools/switchEdition/useSwitch';
import {
  type FlatSwitchEntity,
  flatSwitchToSwitch,
  getNewSwitch,
} from 'applications/editor/tools/switchEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { useInfraID } from 'common/osrdContext';
import { save } from 'reducers/editor/thunkActions';
import { useAppDispatch } from 'store';

import CustomSchemaField from './CustomSchemaField';

const SwitchEditionLeftPanel = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const { state, setState, isFormSubmited, setIsFormSubmited } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SwitchEditionState>;
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Retrieve proper data
  const {
    switchEntity,
    flatSwitchEntity,
    switchType,
    switchTypeOptions,
    switchTypeOptionsDict,
    switchTypesDict,
    switchTypeJSONSchema,
    isNew,
  } = useSwitch();

  // Hack to be able to launch the submit event from the rjsf form by using
  // the toolbar button instead of the form one.
  // See https://github.com/rjsf-team/react-jsonschema-form/issues/500
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited && submitBtnRef.current) {
      submitBtnRef.current.click();
      setIsFormSubmited(false);
    }
  }, [isFormSubmited]);

  if (!switchType || !flatSwitchEntity) return null;
  return (
    <div>
      <legend>{t('Editor.tools.switch-edition.switch-type')}</legend>
      <Select
        options={switchTypeOptions}
        value={switchTypeOptionsDict[switchType.id]}
        onChange={(o) => {
          if (o && o.value !== switchType.id) {
            const newEntity = getNewSwitch(switchTypesDict[o.value]);
            setState({
              ...state,
              entity: newEntity,
              initialEntity: newEntity,
            });
          }
        }}
        isDisabled={!isNew}
      />
      <hr />
      <EditorForm
        key={switchType.id}
        data={flatSwitchEntity}
        overrideSchema={switchTypeJSONSchema}
        overrideFields={{
          SchemaField: CustomSchemaField,
        }}
        onSubmit={async (flatSwitch) => {
          const entityToSave = flatSwitchToSwitch(switchType, flatSwitch as FlatSwitchEntity);

          const res = await dispatch(
            save(
              infraID,
              !isNew
                ? {
                    update: [
                      {
                        source: state.initialEntity as SwitchEntity,
                        target: entityToSave,
                      },
                    ],
                  }
                : { create: [entityToSave] }
            )
          );
          const { railjson } = res[0];
          const { id } = railjson;

          if (id && id !== entityToSave.properties.id) {
            const savedEntity = {
              ...entityToSave,
              properties: { ...entityToSave.properties, id: `${id}` },
            };
            setState({
              ...state,
              initialEntity: savedEntity,
              entity: savedEntity,
            });
          }
        }}
        onChange={debounce((entity) => {
          const flatSwitch = entity as FlatSwitchEntity;
          setState({
            ...state,
            portEditionState: { type: 'idle' },
            entity: {
              ...flatSwitchToSwitch(switchType, flatSwitch),
              geometry: flatSwitch.geometry,
            },
          });
        }, 200)}
      >
        <div>
          {/* We don't want to see the button but just be able to click on it */}
          <button type="submit" ref={submitBtnRef} style={{ display: 'none' }}>
            {t('common.save')}
          </button>
        </div>
      </EditorForm>
      {!isNew && <EntityError className="mt-1" entity={switchEntity} />}
    </div>
  );
};

export default SwitchEditionLeftPanel;
