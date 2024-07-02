import React from 'react';

import { NoEntry, PlusCircle, Trash, XCircle } from '@osrd-project/ui-icons';
import { featureCollection } from '@turf/helpers';
import getNearestPoint from '@turf/nearest-point';
import type { Feature, LineString } from 'geojson';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import { AiFillSave } from 'react-icons/ai';
import { BiAnchor, BiArrowFromLeft, BiArrowToRight, BiReset } from 'react-icons/bi';
import { MdShowChart } from 'react-icons/md';
import { RiDragMoveLine } from 'react-icons/ri';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type { Tool } from 'applications/editor/types';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import { entityDoUpdate, getLineStringDistance } from 'common/IntervalsDataViz/data';
import { save } from 'reducers/editor/thunkActions';
import { nearestPointOnLine, type NearestPointOnLine } from 'utils/geometry';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import { TrackEditionLayers, TrackEditionLeftPanel, TrackEditionMessages } from './components';
import { POINTS_LAYER_ID, TRACK_LAYER_ID } from './consts';
import type { TrackEditionState } from './types';
import { getInitialState } from './utils';
import TOOL_NAMES from '../constsToolNames';

const TrackEditionTool: Tool<TrackEditionState> = {
  id: 'track-edition',
  icon: MdShowChart,
  labelTranslationKey: 'Editor.tools.track-edition.label',
  requiredLayers: new Set(['track_sections']),
  isDisabled({ editorState }) {
    return !editorState.editorLayers.has('track_sections');
  },
  isHidden({ activeTool }) {
    return activeTool.id === TOOL_NAMES.TRACK_SPLIT;
  },
  getInitialState,
  actions: [
    [
      {
        id: 'save-line',
        icon: AiFillSave,
        labelTranslationKey: 'Editor.tools.track-edition.actions.save-line',
        isDisabled({ isLoading, isInfraLocked, state }) {
          return isLoading || state.track.geometry.coordinates.length < 2 || isInfraLocked || false;
        },
        async onClick({ setIsFormSubmited }) {
          if (setIsFormSubmited) {
            setIsFormSubmited(true);
          }
        },
      },
      {
        id: 'reset-entity',
        icon: BiReset,
        labelTranslationKey: `Editor.tools.track-edition.actions.reset-line`,
        isDisabled({ state: { track, initialTrack } }) {
          return isEqual(track, initialTrack);
        },
        onClick({ setState, state: { initialTrack } }) {
          // We set the initialEntity, so its ref changes and the form is remounted
          const track = cloneDeep(initialTrack);
          setState({
            track,
            initialTrack: track,
          });
        },
      },
    ],
    [
      {
        id: 'mode-move-point',
        icon: RiDragMoveLine,
        labelTranslationKey: 'Editor.tools.track-edition.actions.mode-move-point',
        onClick({ setState, state }) {
          setState({
            ...state,
            editionState: {
              type: 'movePoint',
            },
          });
        },
        isActive({ state }) {
          return state.editionState.type === 'movePoint';
        },
      },
      {
        id: 'mode-add-point',
        icon: PlusCircle,
        labelTranslationKey: 'Editor.tools.track-edition.actions.mode-add-point',
        onClick({ setState, state }) {
          setState({
            ...state,
            editionState: { type: 'addPoint' },
          });
        },
        isActive({ state }) {
          return state.editionState.type === 'addPoint';
        },
      },
      {
        id: 'mode-delete-point',
        icon: XCircle,
        labelTranslationKey: 'Editor.tools.track-edition.actions.mode-delete-point',
        onClick({ setState, state }) {
          setState({
            ...state,
            editionState: {
              type: 'deletePoint',
            },
          });
        },
        isActive({ state }) {
          return state.editionState.type === 'deletePoint';
        },
      },
      {
        id: 'toggle-anchoring',
        icon: BiAnchor,
        labelTranslationKey: 'Editor.tools.track-edition.actions.toggle-anchoring',
        onClick({ setState, state }) {
          setState({
            ...state,
            anchorLinePoints: !state.anchorLinePoints,
            nearestPoint: null,
          });
        },
        isActive({ state }) {
          return state.anchorLinePoints;
        },
        isDisabled({ state }) {
          return state.editionState.type === 'deletePoint';
        },
      },
      {
        id: 'add-at-start',
        icon: BiArrowFromLeft,
        labelTranslationKey: 'Editor.tools.track-edition.actions.add-at-start',
        onClick({ setState, state }) {
          setState({
            ...state,
            addNewPointsAtStart: true,
          });
        },
        isHidden({ state }) {
          return state.editionState.type !== 'addPoint' || state.addNewPointsAtStart;
        },
      },
      {
        id: 'add-at-end',
        icon: BiArrowToRight,
        labelTranslationKey: 'Editor.tools.track-edition.actions.add-at-end',
        onClick({ setState, state }) {
          setState({
            ...state,
            addNewPointsAtStart: false,
          });
        },
        isHidden({ state }) {
          return state.editionState.type !== 'addPoint' || !state.addNewPointsAtStart;
        },
      },
      {
        id: 'cancel-line',
        icon: NoEntry,
        labelTranslationKey: 'Editor.tools.track-edition.actions.cancel-line',
        onClick({ setState, state }) {
          if (state.track.geometry.coordinates.length) {
            const newState = cloneDeep(state);
            newState.track.geometry.coordinates = [];
            setState(newState);
          }
        },
        isDisabled({ state }) {
          return !state.track.geometry.coordinates.length;
        },
      },
    ],
    [
      {
        id: 'delete-line',
        icon: Trash,
        labelTranslationKey: 'Editor.tools.track-edition.actions.delete-line',
        // Show button only if we are editing
        isDisabled({ state }) {
          return state.initialTrack.properties.id === NEW_ENTITY_ID;
        },
        onClick({ infraID, openModal, closeModal, forceRender, state, setState, dispatch, t }) {
          openModal(
            <ConfirmModal
              title={t('Editor.tools.track-edition.actions.delete-line')}
              onConfirm={async () => {
                await dispatch(
                  // We have to put state.initialTrack in array because delete initially works with selection which can get multiple elements
                  save(infraID, { delete: [state.initialTrack] })
                );
                setState(getInitialState());
                closeModal();
                forceRender();
              }}
            >
              <p>{t('Editor.tools.track-edition.actions.confirm-delete-line').toString()}</p>
            </ConfirmModal>
          );
        },
      },
    ],
  ],

  // Interactions:
  onClickMap(e, { setState, state }) {
    const { editionState, anchorLinePoints, track, nearestPoint } = state;
    if (editionState.type === 'addPoint') {
      // Adding a point on an existing section:
      if (
        anchorLinePoints &&
        nearestPoint &&
        typeof nearestPoint.properties?.sectionIndex === 'number'
      ) {
        const position = nearestPoint.geometry.coordinates as [number, number];
        const index = nearestPoint.properties.sectionIndex;
        const newState = cloneDeep(state);
        newState.track.geometry.coordinates.splice(index + 1, 0, position);
        newState.track = entityDoUpdate(newState.track, state.track.geometry);
        newState.nearestPoint = null;
        setState(newState);
      }
      // Adding a new point at the extremity of the track:
      else {
        const position = (
          anchorLinePoints && nearestPoint ? nearestPoint.geometry.coordinates : e.lngLat.toArray()
        ) as [number, number];

        const points = track.geometry.coordinates;
        const lastPoint = points[points.length - 1];

        if (!isEqual(lastPoint, position)) {
          const newState = cloneDeep(state);
          if (state.addNewPointsAtStart) {
            newState.track.geometry.coordinates.unshift(position);
          } else {
            newState.track.geometry.coordinates.push(position);
          }

          newState.nearestPoint = null;

          // compute new length if it's newly tracksection
          if (newState.track.properties.id === NEW_ENTITY_ID) {
            newState.track.properties.length = getLineStringDistance(newState.track.geometry);
          }
          setState(newState);
        } else {
          setState({
            ...state,
            editionState: {
              type: 'movePoint',
            },
          });
        }
      }
    } else if (editionState.type === 'movePoint') {
      if (typeof editionState.draggedPointIndex === 'number') {
        setState({
          ...state,
          editionState: {
            ...editionState,
            draggedPointIndex: undefined,
          },
        });
      } else if (typeof editionState.hoveredPointIndex === 'number') {
        setState({
          ...state,
          editionState: {
            ...editionState,
            draggedPointIndex: editionState.hoveredPointIndex,
            hoveredPointIndex: undefined,
          },
        });
      }
    } else if (
      editionState.type === 'deletePoint' &&
      typeof editionState.hoveredPointIndex === 'number'
    ) {
      const newState = cloneDeep(state);
      newState.editionState = { type: 'deletePoint' };
      newState.track.geometry.coordinates.splice(editionState.hoveredPointIndex, 1);
      newState.track = entityDoUpdate(newState.track, state.track.geometry);
      setState(newState);
    }
  },
  onMove(e, { setState, state }) {
    const { editionState, track, anchorLinePoints, nearestPoint } = state;
    const newState: Partial<TrackEditionState> = {};
    const coordinates = e.lngLat.toArray();

    if (editionState.type === 'addPoint' && anchorLinePoints) {
      if (track.geometry.coordinates.length > 1) {
        const closest = nearestPointOnLine(track.geometry, coordinates);
        const closestPosition = closest.geometry.coordinates;

        if (track.geometry.coordinates.every((point) => !isEqual(point, closestPosition))) {
          newState.nearestPoint = {
            ...closest,
            properties: {
              sectionIndex: closest.properties.index,
            },
          };
        }
      }
    }

    if (anchorLinePoints && !newState.nearestPoint) {
      const candidates: NearestPointOnLine[] = [];

      const closestTrack = getMapMouseEventNearestFeature(e, {
        layersId: ['editor/geo/track-main'],
        tolerance: 50,
      })?.feature;
      if (closestTrack) {
        candidates.push(
          nearestPointOnLine(closestTrack as Feature<LineString>, e.lngLat.toArray())
        );
      }
      if (newState.nearestPoint) {
        candidates.push(newState.nearestPoint);
      }

      if (candidates.length === 1) {
        // eslint-disable-next-line prefer-destructuring
        newState.nearestPoint = candidates[0];
      } else if (candidates.length > 1) {
        newState.nearestPoint = getNearestPoint(e.lngLat.toArray(), featureCollection(candidates));
      } else if (nearestPoint) {
        newState.nearestPoint = null;
      }
    }

    if (
      (editionState.type === 'movePoint' && typeof editionState.draggedPointIndex !== 'number') ||
      editionState.type === 'deletePoint'
    ) {
      const point = getMapMouseEventNearestFeature(e, {
        layersId: [POINTS_LAYER_ID],
      });

      if (!point && typeof editionState.hoveredPointIndex === 'number') {
        newState.editionState = {
          ...editionState,
          hoveredPointIndex: undefined,
        };
      } else if (point && typeof editionState.hoveredPointIndex !== 'number') {
        newState.editionState = {
          ...editionState,
          hoveredPointIndex: point.feature.properties?.index as number,
        };
      }
    }

    if (editionState.type === 'movePoint' && typeof editionState.draggedPointIndex === 'number') {
      const newTrack = cloneDeep(track);
      newTrack.geometry.coordinates[editionState.draggedPointIndex] = (
        anchorLinePoints && nearestPoint ? nearestPoint.geometry.coordinates : e.lngLat.toArray()
      ) as [number, number];

      newState.track = entityDoUpdate(newTrack, track.geometry);
    }

    if (!isEmpty(newState)) setState(newState);
  },
  onKeyDown(e, { state, setState }) {
    if (e.key === 'Escape') {
      if (state.editionState.type === 'addPoint') {
        setState({ ...state, editionState: { type: 'movePoint' } });
      }

      if (
        state.editionState.type === 'movePoint' &&
        typeof state.editionState.draggedPointIndex === 'number'
      ) {
        setState({
          ...state,
          editionState: {
            ...state.editionState,
            draggedPointIndex: undefined,
          },
        });
      }
    }
  },

  getInteractiveLayers() {
    return ['editor/geo/track-main', POINTS_LAYER_ID, TRACK_LAYER_ID];
  },

  getCursor({ state }, { isDragging }) {
    if (isDragging) return 'grabbing';
    if (state.editionState.type === 'addPoint') return 'copy';
    if (state.editionState.type === 'movePoint') {
      if (typeof state.editionState.draggedPointIndex === 'number') return 'grabbing';
      if (typeof state.editionState.hoveredPointIndex === 'number') return 'pointer';
    }
    if (state.editionState.type === 'deletePoint') {
      if (typeof state.editionState.hoveredPointIndex === 'number') return 'pointer';
    }
    return 'default';
  },

  layersComponent: TrackEditionLayers,
  leftPanelComponent: TrackEditionLeftPanel,
  messagesComponent: TrackEditionMessages,
};

export default TrackEditionTool;
