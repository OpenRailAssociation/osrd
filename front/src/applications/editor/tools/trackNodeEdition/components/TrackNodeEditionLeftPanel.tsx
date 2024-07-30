import React, { useContext, useEffect, useRef } from 'react';

import { debounce, omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';

import EditorForm from 'applications/editor/components/EditorForm';
import EntityError from 'applications/editor/components/EntityError';
import EditorContext from 'applications/editor/context';
import type {
  TrackNodeEditionState,
  TrackNodeEntity,
} from 'applications/editor/tools/trackNodeEdition/types';
import useTrackNode from 'applications/editor/tools/trackNodeEdition/useTrackNode';
import {
  type FlatTrackNodeEntity,
  flatTrackNodeToTrackNode,
  getNewTrackNode,
} from 'applications/editor/tools/trackNodeEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { useInfraID } from 'common/osrdContext';
import { save } from 'reducers/editor/thunkActions';
import { useAppDispatch } from 'store';

import CustomSchemaField from './CustomSchemaField';

const TrackNodeEditionLeftPanel = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const { state, setState, isFormSubmited, setIsFormSubmited } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<TrackNodeEditionState>;
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Retrieve proper data
  const {
    trackNodeEntity,
    flatTrackNodeEntity,
    trackNodeType,
    trackNodeTypeOptions,
    trackNodeTypeOptionsDict,
    trackNodeTypesDict,
    trackNodeTypeJSONSchema,
    isNew,
  } = useTrackNode();

  // Hack to be able to launch the submit event from the rjsf form by using
  // the toolbar button instead of the form one.
  // See https://github.com/rjsf-team/react-jsonschema-form/issues/500
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited && submitBtnRef.current) {
      submitBtnRef.current.click();
      setIsFormSubmited(false);
    }
  }, [isFormSubmited]);

  if (!trackNodeType || !flatTrackNodeEntity) return null;
  return (
    <div>
      <legend>{t('Editor.tools.switch-edition.switch-type')}</legend>
      <Select
        options={trackNodeTypeOptions}
        value={trackNodeTypeOptionsDict[trackNodeType.id]}
        onChange={(o) => {
          if (o && o.value !== trackNodeType.id) {
            const newEntity = getNewTrackNode(trackNodeTypesDict[o.value]);
            // keep track of the common props when switching types
            setState({
              ...state,
              entity: {
                ...newEntity,
                properties: {
                  ports: {},
                  ...omit(state.entity.properties, ['ports']),
                  ...newEntity.properties,
                },
              },
              initialEntity: newEntity,
            });
          }
        }}
        isDisabled={!isNew}
      />
      <hr />
      <EditorForm
        key={trackNodeType.id}
        data={flatTrackNodeEntity}
        overrideSchema={trackNodeTypeJSONSchema}
        overrideFields={{
          SchemaField: CustomSchemaField,
        }}
        onSubmit={async (flatTrackNode) => {
          const entityToSave = flatTrackNodeToTrackNode(trackNodeType, flatTrackNode as FlatTrackNodeEntity);

          const res = await dispatch(
            save(
              infraID,
              !isNew
                ? {
                    update: [
                      {
                        source: state.initialEntity as TrackNodeEntity,
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
          const flatTrackNode = entity as FlatTrackNodeEntity;
          setState({
            ...state,
            portEditionState: { type: 'idle' },
            entity: {
              ...flatTrackNodeToTrackNode(trackNodeType, flatTrackNode),
              geometry: flatTrackNode.geometry,
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
      {!isNew && <EntityError className="mt-1" entity={trackNodeEntity} />}
    </div>
  );
};

export default TrackNodeEditionLeftPanel;
