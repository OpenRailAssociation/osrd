import { debounce } from 'lodash';
import React, { useContext, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';

import { useInfraID } from 'common/osrdContext';
import { save } from 'reducers/editor';
import type { TrackNodeEntity } from 'types';

import EditorContext from '../../../context';
import EditorForm from '../../../components/EditorForm';
import EntityError from '../../../components/EntityError';
import type { ExtendedEditorContextType } from '../../editorContextTypes';
import useTrackNode from '../useTrackNode';
import { TrackNodeEditionState } from '../types';
import { type FlatTrackNodeEntity, flatTrackNodeToTrackNode, getNewTrackNode } from '../utils';
import CustomSchemaField from './CustomSchemaField';

const TrackNodeEditionLeftPanel = () => {
  const dispatch = useDispatch();
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

  if (!trackNodeType || !flatTrackNodeEntity) {
    return null;
  }

  // Hack to be able to launch the submit event from the rjsf form by using
  // the toolbar button instead of the form one.
  // See https://github.com/rjsf-team/react-jsonschema-form/issues/500
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited && submitBtnRef.current) {
      submitBtnRef.current.click();
      setIsFormSubmited(false);
    }
  }, [isFormSubmited]);

  return (
    <div>
      <legend>{t('Editor.tools.track-node-edition.track-node-type')}</legend>
      <Select
        options={trackNodeTypeOptions}
        value={trackNodeTypeOptionsDict[trackNodeType.id]}
        onChange={(o) => {
          if (o && o.value !== trackNodeType.id) {
            const newEntity = getNewTrackNode(trackNodeTypesDict[o.value]);
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
        key={trackNodeType.id}
        data={flatTrackNodeEntity}
        overrideSchema={trackNodeTypeJSONSchema}
        overrideFields={{
          SchemaField: CustomSchemaField,
        }}
        onSubmit={async (flatTrackNode) => {
          const entityToSave = flatTrackNodeToTrackNode(trackNodeType, flatTrackNode as FlatTrackNodeEntity);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res: any = await dispatch(
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
