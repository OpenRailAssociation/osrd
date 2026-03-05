import { useEffect } from 'react';

import { t } from 'i18next';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import type { ObjectType } from 'common/api/osrdEditoastApi';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import { getEditorState } from 'reducers/editor/selectors';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import type { EditoastType } from '../consts';
import { getEntity, getMixedEntities } from '../data/api';
import { centerMapOnObject, selectEntities } from '../tools/utils';
import type { EditorContextType } from '../types';
import type { EditorEntity } from '../typesEditorEntity';

const EditorUrlSelection = ({ switchTool }: { switchTool: EditorContextType['switchTool'] }) => {
  const dispatch = useAppDispatch();
  const { urlInfra } = useParams();
  const editorState = useSelector(getEditorState);
  const { updateViewport } = useMapSettingsActions();
  const { viewport } = useMapSettings();

  /**
   * When the component mounts
   * => get the searchParams
   * => if there is a selection param, select the entities and focus on them
   */
  useEffect(() => {
    if (urlInfra) {
      const searchParams = new URLSearchParams(window.location.search);
      const params = searchParams.get('selection');
      const paramsList = params?.split('|');

      if (paramsList && paramsList.length) {
        const selectedEntities = paramsList.map((param) => {
          const [objType, entityId] = param.split('~');
          return {
            id: entityId,
            type: objType as EditoastType,
          };
        });

        const selectObjectsAndFocus = async (
          entitiesInfos: { id: string; type: EditoastType }[]
        ) => {
          let entities: EditorEntity[];
          if (!entitiesInfos.length) return;
          try {
            if (entitiesInfos.length === 1) {
              const { type: objType, id: entityId } = selectedEntities[0];
              const entity = await getEntity(+urlInfra, entityId, objType as ObjectType, dispatch);
              entities = [entity];
            } else {
              const entitiesRecord = await getMixedEntities(+urlInfra, entitiesInfos, dispatch);
              entities = Object.values(entitiesRecord);
            }
            selectEntities(entities, { switchTool, dispatch, editorState });
            centerMapOnObject(+urlInfra, entities, dispatch, updateViewport, viewport);
          } catch (e) {
            dispatch(
              setFailure(
                castErrorToFailure(e, {
                  name: t('Editor.tools.select-items.errors.unable-to-select'),
                  message: t('Editor.tools.select-items.errors.invalid-url'),
                })
              )
            );
          }
        };
        selectObjectsAndFocus(selectedEntities);
      }
    }
  }, []);

  return null;
};

export default EditorUrlSelection;
