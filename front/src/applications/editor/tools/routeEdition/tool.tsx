import { PlusCircle, Trash } from '@osrd-project/ui-icons';
import { isEqual } from 'lodash';
import { AiFillSave } from 'react-icons/ai';
import { BiReset } from 'react-icons/bi';
import { GiPathDistance } from 'react-icons/gi';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type { Tool } from 'applications/editor/types';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF/ConfirmModal';
import { save } from 'reducers/editor/thunkActions';

import { RouteEditionLayers, RouteEditionLeftPanel, RouteEditionMessages } from './components';
import type { RouteEditionState, WayPointEntity } from './types';
import { getRouteEditionState } from './utils';

const RouteEditionTool: Tool<RouteEditionState> = {
  id: 'route-edition',
  icon: GiPathDistance,
  labelTranslationKey: 'Editor.tools.routes-edition.label',
  requiredLayers: new Set(['buffer_stops', 'detectors']),
  incompatibleLayers: ['errors'],
  getInitialState: () => getRouteEditionState(),
  actions: [
    [
      {
        id: 'save-route',
        icon: AiFillSave,
        labelTranslationKey: 'Editor.tools.routes-edition.actions.save-route',
        isDisabled({ state: { isComplete } }) {
          return !isComplete;
        },
        async onClick({ setIsFormSubmitted }) {
          if (setIsFormSubmitted) {
            setIsFormSubmitted(true);
          }
        },
      },
      {
        id: 'reset-route',
        icon: BiReset,
        labelTranslationKey: `Editor.tools.routes-edition.actions.reset-route`,
        isDisabled({ state: { entity, initialEntity } }) {
          return isEqual(entity, initialEntity);
        },
        onClick({ state: { initialEntity }, setState }) {
          setState(getRouteEditionState(initialEntity));
        },
      },
    ],
    [
      {
        id: 'new-route',
        icon: PlusCircle,
        labelTranslationKey: 'Editor.tools.routes-edition.actions.new-route',
        onClick({ setState }) {
          setState(getRouteEditionState());
        },
      },
    ],
    [
      {
        id: 'delete-route',
        icon: Trash,
        labelTranslationKey: 'Editor.tools.routes-edition.actions.delete-route',
        // Show button only if we are editing
        isDisabled({ state: { entity } }) {
          return entity.properties.id === NEW_ENTITY_ID;
        },
        onClick({ infraID, openModal, closeModal, forceRender, state, setState, dispatch, t }) {
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
        },
      },
    ],
  ],

  getCursor({ state }) {
    if (state.extremityState.type === 'selection' && state.hovered) return 'pointer';
    return 'default';
  },
  onClickEntity(feature, _e, { state }) {
    if (
      state.extremityState.type === 'selection' &&
      (feature.objType === 'Detector' || feature.objType === 'BufferStop')
    ) {
      state.extremityState.onSelect(feature as WayPointEntity);
    }
  },

  messagesComponent: RouteEditionMessages,
  layersComponent: RouteEditionLayers,
  leftPanelComponent: RouteEditionLeftPanel,
  getInteractiveLayers() {
    return ['editor/geo/buffer-stop-main', 'editor/geo/detector-main', 'editor/geo/detector-name'];
  },
};

export default RouteEditionTool;
