import { PlusCircle, Trash } from '@osrd-project/ui-icons';
import { isEqual } from 'lodash';
import { AiFillSave } from 'react-icons/ai';
import { BiReset } from 'react-icons/bi';
import { RiPinDistanceLine } from 'react-icons/ri';

import { TRACKS_LAYER_ID } from 'applications/editor/tools/consts';
import {
  approximatePointDistanceForEditoast,
  getTrackPositionFromEvent,
} from 'applications/editor/tools/utils';
import type { Tool } from 'applications/editor/types';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import { save } from 'reducers/editor/thunkActions';
import { getNearestPoint } from 'utils/mapHelper';

import OpEditionLayers from './components/OpEditionLayers';
import OpEditionLeftPanel from './components/OpEditionLeftPanel';
import OpEditionMessages from './components/OpEditionMessages';
import { PARTS_LAYER_ID } from './consts';
import type { OpEditionState, OpEntity } from './types';
import {
  addPart,
  canSaveOp,
  getFeaturePartIndex,
  getOpEditionState,
  isNewOp,
  updatePart,
} from './utils';

const OpEditionTool: Tool<OpEditionState> = {
  id: 'op-edition',
  icon: RiPinDistanceLine,
  labelTranslationKey: 'Editor.tools.op-edition.label',
  requiredLayers: new Set(['operational_points', 'track_sections']),
  getInitialState: () => getOpEditionState(),
  actions: [
    [
      {
        id: 'save-op',
        icon: AiFillSave,
        labelTranslationKey: 'Editor.tools.op-edition.actions.save-op',
        isDisabled({ isLoading, isInfraLocked, state: { entity } }) {
          return isLoading || isInfraLocked || !canSaveOp(entity);
        },
        onClick({
          state: { entity, initialEntity },
          setState,
          dispatch,
          infraID,
          forceRender,
          protectedAction,
        }) {
          protectedAction?.(async () => {
            const result = await dispatch(
              save(
                infraID,
                isNewOp(entity)
                  ? { create: [entity] }
                  : { update: [{ source: initialEntity, target: entity }] }
              )
            );
            setState(getOpEditionState({ ...entity, properties: result[0].railjson } as OpEntity));
            // Forces fetching the updated OP tiles, to get an up-to-date
            // render on other tools later on:
            forceRender();
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
    [
      {
        id: 'delete-op',
        icon: Trash,
        labelTranslationKey: 'Editor.tools.op-edition.actions.delete-op',
        isDisabled({ state: { initialEntity } }) {
          return isNewOp(initialEntity);
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
                title={t('Editor.tools.op-edition.actions.delete-op')}
                onConfirm={async () => {
                  await dispatch(save(infraID, { delete: [state.initialEntity] }));
                  setState(getOpEditionState());
                  closeModal();
                  forceRender();
                }}
              >
                <p>{t('Editor.tools.op-edition.actions.confirm-delete-op')}</p>
              </ConfirmModal>
            );
          });
        },
      },
    ],
  ],

  getCursor({ state: { interactionState, hovered, hoveredPartIndex } }) {
    if (interactionState.type === 'movePart') return 'grabbing';
    if (hovered || hoveredPartIndex !== null) return 'pointer';
    return 'default';
  },
  onHover(e, { setState }) {
    const feature = e.features?.[0];
    const partIndex = getFeaturePartIndex(feature);
    if (partIndex !== null) {
      setState({ hovered: null, hoveredPartIndex: partIndex });
    } else if (feature?.sourceLayer === 'track_sections') {
      setState({
        hovered: { type: 'TrackSection', id: feature.properties.id, renderedEntity: feature },
        hoveredPartIndex: null,
      });
    } else {
      setState({ hovered: null, hoveredPartIndex: null });
    }
  },
  onMouseDown(e, { setState }) {
    const partIndex = getFeaturePartIndex(e.features?.[0]);
    if (partIndex === null) return;
    // Prevents the map from panning
    e.preventDefault();
    setState({
      hoveredPartIndex: null,
      selectedPartIndex: partIndex,
      interactionState: { type: 'movePart', partIndex },
    });
  },
  onMouseUp(_e, { setState, state: { interactionState } }) {
    if (interactionState.type === 'movePart') setState({ interactionState: { type: 'idle' } });
  },
  onMove(
    e,
    { setState, state: { entity, interactionState, trackSectionsCache, hoveredPartIndex } }
  ) {
    // Clean hoveredPartIndex, to remove the hovered item overlay while dragging:
    if (!e.features?.length && hoveredPartIndex !== null) setState({ hoveredPartIndex: null });
    if (interactionState.type !== 'movePart') return;

    // This detects when the mouse is released outside the map (so onMouseUp was not triggered):
    if (e.originalEvent.buttons === 0) {
      setState({ interactionState: { type: 'idle' } });
      return;
    }

    const newPosition = getTrackPositionFromEvent(e, trackSectionsCache);
    if (newPosition)
      setState({ entity: updatePart(entity, interactionState.partIndex, newPosition) });
  },
  onClickMap(e, { setState, state: { entity, trackSectionsCache } }) {
    const feature = e.features?.[0];
    const partIndex = getFeaturePartIndex(feature);
    if (partIndex !== null) {
      setState({ selectedPartIndex: partIndex });
    } else if (feature?.sourceLayer === 'track_sections') {
      const trackState = trackSectionsCache[feature.properties.id];
      if (trackState?.type !== 'success') return;
      const { track } = trackState;
      const nearestPoint = getNearestPoint([track], e.lngLat.toArray());
      const position = approximatePointDistanceForEditoast(track, nearestPoint.geometry);
      setState({
        entity: addPart(entity, track.properties.id, position),
        selectedPartIndex: entity.properties.parts.length,
      });
    }
  },

  getInteractiveLayers: () => [TRACKS_LAYER_ID, PARTS_LAYER_ID],
  getEventsLayers: () => [TRACKS_LAYER_ID, PARTS_LAYER_ID],
  getHiddenOperationalPoints: ({ state }) => [state.entity.properties.id],
  layersComponent: OpEditionLayers,
  leftPanelComponent: OpEditionLeftPanel,
  messagesComponent: OpEditionMessages,
};

export default OpEditionTool;
