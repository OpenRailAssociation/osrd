import { PlusCircle, Trash } from '@osrd-project/ui-icons';
import { isEqual } from 'lodash';
import { AiFillSave } from 'react-icons/ai';
import { BiReset } from 'react-icons/bi';
import { GiPathDistance } from 'react-icons/gi';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type { Tool } from 'applications/editor/types';
import { DEFAULT_COMMON_TOOL_STATE } from 'applications/editor/tools/consts';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF/ConfirmModal';
import { save } from 'reducers/editor/thunkActions';

//import { RouteEditionLayers, RouteEditionLeftPanel, RouteEditionMessages } from './components';
import OpEditionLeftPanel from './components/OpEditionLeftPanel';
import type { OpEditionState } from './types';
import { getOpEditionState } from './utils';

const OpEditionTool: Tool<OpEditionState> = {
  id: 'op-edition',
  icon: GiPathDistance,
  labelTranslationKey: 'Editor.tools.op-edition.label',
  requiredLayers: new Set(['buffer_stops', 'detectors']),
  incompatibleLayers: ['errors'],
  getInitialState: () => getOpEditionState(),
  actions: [
    [
      {
        id: 'save-op',
        icon: AiFillSave,
        labelTranslationKey: 'Editor.tools.op-edition.actions.save-op',
        isDisabled({ state: { isComplete } }) {
          return !isComplete;
        },
        onClick({ setIsFormSubmited, protectedAction }) {
          protectedAction?.(() => {
            if (setIsFormSubmited) {
              setIsFormSubmited(true);
            }
          });
        },
      },
      {
        id: 'reset-op',
        icon: BiReset,
        labelTranslationKey: 'Editor.tools.op-edition.actions.reset-op',
        isDisabled({ state: { entity, initialEntity } }) {
          return isEqual(entity, initialEntity);
        },
        onClick({ state: { initialEntity }, setState }) {
          setState(getOpEditionState(initialEntity));
        },
      },
    ],
    [
      {
        id: 'new-op',
        icon: PlusCircle,
        labelTranslationKey: 'Editor.tools.op-edition.actions.new-op',
        onClick({ setState }) {
          setState(getOpEditionState());
        },
      },
    ],
    /*[
      {
        id: 'delete-route',
        icon: Trash,
        labelTranslationKey: 'Editor.tools.routes-edition.actions.delete-route',
        // Show button only if we are editing
        isDisabled({ state: { entity } }) {
          return entity.properties.id === NEW_ENTITY_ID;
        },
        onClick({
          infraID,
          openModal,
          closeModal,
          forceRender,
          state,
          setState,
          dispatch,
          t,
          protectedAction,
        }) {
          protectedAction?.(() => {
            openModal(
              <ConfirmModal
                title={t('Editor.tools.routes-edition.delete-route')}
                onConfirm={async () => {
                  if (state.entity) {
                    await dispatch(save(infraID, { delete: [state.entity] }));
                    setState(getRouteEditionState());
                    closeModal();
                    forceRender();
                  }
                }}
              >
                <p>{t('Editor.tools.routes-edition.confirm-delete-route').toString()}</p>
              </ConfirmModal>
            );
          });
        },
      },
    ],*/
  ],

  getCursor({ state }) {
    //if (state.extremityState.type === 'selection' && state.hovered) return 'pointer';
    return 'default';
  },
  onClickEntity(feature, _e, { state }) {
    /*if (
      state.extremityState.type === 'selection' &&
      (feature.objType === 'Detector' || feature.objType === 'BufferStop')
    ) {
      state.extremityState.onSelect(feature as WayPointEntity);
    }*/
  },

  //messagesComponent: RouteEditionMessages,
  //layersComponent: RouteEditionLayers,
  leftPanelComponent: OpEditionLeftPanel,
  getInteractiveLayers() {
    return [/*'editor/geo/buffer-stop-main', 'editor/geo/detector-main', 'editor/geo/detector-name'*/];
  },
};

export default OpEditionTool;
