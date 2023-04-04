import React from 'react';
import { BiLoader, BiSelection, BsCursor, BsTrash, FaDrawPolygon, FiEdit } from 'react-icons/all';
import { PointLike } from 'mapbox-gl';
import { isEqual, max, min } from 'lodash';

import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF/ConfirmModal';
import { DEFAULT_COMMON_TOOL_STATE, LAYER_TO_EDITOAST_DICT, LayerType, Tool } from '../types';
import { save } from '../../../../reducers/editor';
import { SelectionState } from './types';
import { SelectionLayers, SelectionMessages, SelectionLeftPanel } from './components';
import TrackEditionTool from '../trackEdition/tool';
import {
  BufferStopEntity,
  DetectorEntity,
  SignalEntity,
  SwitchEntity,
  TrackSectionEntity,
} from '../../../../types';
import {
  BufferStopEditionTool,
  DetectorEditionTool,
  SignalEditionTool,
} from '../pointEdition/tools';
import SwitchEditionTool from '../switchEdition/tool';
import { getMixedEntities } from '../../data/api';
import { selectInZone } from '../../../../utils/mapboxHelper';

const SelectionTool: Tool<SelectionState> = {
  id: 'select-items',
  icon: BsCursor,
  labelTranslationKey: 'Editor.tools.select-items.label',
  getInitialState() {
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      selectionState: { type: 'single' },
      selection: [],
      showModal: null,
      isLoading: false,
    };
  },
  actions: [
    // Different selection modes:
    [
      {
        id: 'mode-single',
        icon: BsCursor,
        labelTranslationKey: 'Editor.tools.select-items.actions.single',
        isActive({ state }) {
          return state.selectionState.type === 'single';
        },
        onClick({ setState, state }) {
          setState({
            ...state,
            selectionState: { type: 'single' },
          });
        },
      },
      {
        id: 'mode-rectangle',
        icon: BiSelection,
        labelTranslationKey: 'Editor.tools.select-items.actions.rectangle',
        isActive({ state }) {
          return state.selectionState.type === 'rectangle';
        },
        onClick({ setState, state }) {
          setState({
            ...state,
            selectionState: { type: 'rectangle', rectangleTopLeft: null },
          });
        },
      },
      {
        id: 'mode-polygon',
        icon: FaDrawPolygon,
        labelTranslationKey: 'Editor.tools.select-items.actions.polygon',
        isActive({ state }) {
          return state.selectionState.type === 'polygon';
        },
        onClick({ setState, state }) {
          setState({
            ...state,
            selectionState: { type: 'polygon', polygonPoints: [] },
          });
        },
      },
      {
        id: 'mode-edition',
        icon: FiEdit,
        labelTranslationKey: 'Editor.tools.select-items.actions.edit-info',
        isDisabled({ state }) {
          const types = new Set<string>();
          state.selection.forEach((item) => types.add(item.objType));
          return types.size !== 1;
        },
        onClick({ state, switchTool }) {
          if (state.selection.length === 1) {
            const selectedElement = state.selection[0];
            switch (selectedElement.objType) {
              case 'TrackSection':
                switchTool(TrackEditionTool, {
                  initialTrack: selectedElement as TrackSectionEntity,
                  track: selectedElement as TrackSectionEntity,
                  editionState: {
                    type: 'movePoint',
                  },
                });
                break;
              case 'Signal':
                switchTool(SignalEditionTool, {
                  initialEntity: selectedElement as SignalEntity,
                  entity: selectedElement as SignalEntity,
                });
                break;
              case 'BufferStop':
                switchTool(BufferStopEditionTool, {
                  initialEntity: selectedElement as BufferStopEntity,
                  entity: selectedElement as BufferStopEntity,
                });
                break;
              case 'Detector':
                switchTool(DetectorEditionTool, {
                  initialEntity: selectedElement as DetectorEntity,
                  entity: selectedElement as DetectorEntity,
                });
                break;
              case 'Switch':
                switchTool(SwitchEditionTool, {
                  initialEntity: selectedElement as SwitchEntity,
                  entity: selectedElement as SwitchEntity,
                });
                break;
              default:
                break;
            }
          }
        },
      },
    ],
    // Selection actions:
    [
      {
        id: 'unselect-all',
        icon: BiLoader,
        labelTranslationKey: 'Editor.tools.select-items.actions.unselect-all',
        isDisabled({ state }) {
          return !state.selection.length;
        },
        onClick({ setState, state }) {
          setState({
            ...state,
            selection: [],
          });
        },
      },
      {
        id: 'delete-selection',
        icon: BsTrash,
        labelTranslationKey: 'Editor.tools.select-items.actions.delete-selection',
        isDisabled({ state }) {
          return !state.selection.length;
        },
        onClick({ openModal, closeModal, forceRender, state, setState, dispatch, t }) {
          openModal(
            <ConfirmModal
              title={t('Editor.tools.select-items.actions.delete-selection')}
              onConfirm={async () => {
                await dispatch<ReturnType<typeof save>>(save({ delete: state.selection }));
                setState({ ...state, selection: [] });
                closeModal();
                forceRender();
              }}
            >
              <p>{t('Editor.tools.select-items.actions.confirm-delete-selection')}</p>
            </ConfirmModal>
          );
        },
      },
    ],
  ],

  // Interactions:
  onClickEntity(feature, e, { setState, state }) {
    if (state.isLoading) return;

    if (state.selectionState.type !== 'single') return;

    let { selection } = state;
    const isAlreadySelected = selection.find(
      (item) => item.properties.id === feature.properties.id
    );

    const current = feature;

    if (current) {
      if (!isAlreadySelected) {
        if (e.originalEvent.ctrlKey) {
          selection = selection.concat([current]);
        } else {
          selection = [current];
        }
      } else if (e.originalEvent.ctrlKey) {
        selection = selection.filter((item) => item.properties.id !== feature.properties.id);
      } else if (selection.length === 1) {
        selection = [];
      } else {
        selection = [current];
      }
    }

    setState({
      ...state,
      selection,
    });
  },
  onClickMap(e, { setState, state, infraID }) {
    const position = e.lngLat;
    const map = e.target;

    if (state.isLoading) return;

    if (state.selectionState.type === 'rectangle') {
      if (state.selectionState.rectangleTopLeft) {
        if (isEqual(state.selectionState.rectangleTopLeft, position)) {
          setState({
            ...state,
            selectionState: { ...state.selectionState, rectangleTopLeft: null },
          });
        } else {
          const selection = map
            .queryRenderedFeatures([
              map.project(state.selectionState.rectangleTopLeft),
              map.project(position.toArray() as [number, number]),
            ])
            .filter((f) => !f.layer.id.startsWith('osm'));

          setState({ isLoading: true });
          getMixedEntities(
            infraID as number,
            selection.flatMap((entity) =>
              entity.properties?.id
                ? [
                    {
                      id: entity.properties.id as string,
                      type: LAYER_TO_EDITOAST_DICT[entity.sourceLayer as LayerType],
                    },
                  ]
                : []
            )
          ).then((entities) => {
            setState({
              isLoading: false,
              selectionState: {
                ...state.selectionState,
                type: 'rectangle',
                rectangleTopLeft: null,
              },
              selection: Object.values(entities),
            });
          });
        }
      } else {
        setState({
          ...state,
          selectionState: {
            ...state.selectionState,
            rectangleTopLeft: position.toArray() as [number, number],
          },
        });
      }
    } else if (state.selectionState.type === 'polygon') {
      const points = state.selectionState.polygonPoints;
      const lastPoint = points[points.length - 1];
      const positionPoint = [position.lng, position.lat];

      if (isEqual(lastPoint, positionPoint)) {
        if (points.length >= 3) {
          const lngs = points.map((point) => point[0]);
          const lats = points.map((point) => point[1]);
          const selection = selectInZone(
            map
              .queryRenderedFeatures([
                map.project([min(lngs) as number, min(lats) as number]),
                map.project([max(lngs) as number, max(lats) as number]),
              ] as [PointLike, PointLike])
              .filter((f) => !f.layer.id.startsWith('osm')),
            {
              type: 'polygon',
              points,
            }
          );

          setState({ isLoading: true });
          getMixedEntities(
            infraID as number,
            selection.flatMap((entity) =>
              entity.properties?.id
                ? [
                    {
                      id: entity.properties.id as string,
                      type: LAYER_TO_EDITOAST_DICT[entity.sourceLayer as LayerType],
                    },
                  ]
                : []
            )
          ).then((entities) => {
            setState({
              isLoading: false,
              selectionState: { ...state.selectionState, type: 'polygon', polygonPoints: [] },
              selection: Object.values(entities),
            });
          });
        }
      } else {
        setState({
          ...state,
          selectionState: {
            ...state.selectionState,
            polygonPoints: points.concat([position.toArray() as [number, number]]),
          },
        });
      }
    }
  },

  // Layers:
  getCursor({ state }, { isDragging }) {
    if (isDragging) return 'move';
    if (state.selectionState.type === 'single' && state.hovered) return 'pointer';
    if (state.selectionState.type === 'rectangle' || state.selectionState.type === 'polygon')
      return 'crosshair';
    return 'default';
  },

  layersComponent: SelectionLayers,
  leftPanelComponent: SelectionLeftPanel,
  messagesComponent: SelectionMessages,
};

export default SelectionTool;
