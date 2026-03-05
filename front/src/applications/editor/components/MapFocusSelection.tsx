import { useEffect } from 'react';

import { t } from 'i18next';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { ObjectType } from 'common/api/osrdEditoastApi';
import { getEditorState } from 'reducers/editor/selectors';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import type { Viewport } from 'reducers/commonMap/types';
import type { EditoastType } from '../consts';
import { getEntity, getMixedEntities } from '../data/api';
import { centerMapOnObject, selectEntities } from '../tools/utils';
import type { EditorContextType } from '../types';
import type { EditorEntity } from '../typesEditorEntity';

const MapFocusSelection = ({
  switchTool,
  setViewport,
}: {
  switchTool: EditorContextType['switchTool'];
  setViewport: (value: Partial<Viewport>) => void;
}) => {
  const dispatch = useAppDispatch();
  const { urlInfra } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editorState = useSelector(getEditorState);

  /**
   * When the component mounts
   * => get the searchParams
   * => if there is a selection param, select the entities and focus on them
   */
  useEffect(() => {
    if (urlInfra) {
      const params = searchParams.get('selection');
      if (!params && searchParams.size !== 0) {
        dispatch(
          setFailure({
            name: t('Editor.tools.select-items.errors.unable-to-select'),
            message: t('Editor.tools.select-items.errors.invalid-url'),
          })
        );
        navigate(`/editor/${urlInfra}`);
      }
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

            centerMapOnObject(+urlInfra, entities, dispatch, setViewport);
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

export default MapFocusSelection;
