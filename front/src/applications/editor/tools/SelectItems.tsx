import React from 'react';
import {
  BiLoader,
  BiSelection,
  BsCursor,
  BsInfoSquare,
  BsTrash,
  FaDrawPolygon,
  FiEdit,
  MdSelectAll,
} from 'react-icons/all';
import { isEqual } from 'lodash';
import { Popup } from 'react-map-gl';

import { CommonToolState, DEFAULT_COMMON_TOOL_STATE, Tool } from './common';
import { EditorEntity, Item, Zone } from '../../../types';
import { EditorState, clippedDataSelector, save } from '../../../reducers/editor';
import { selectInZone } from '../../../utils/mapboxHelper';
import EditorZone from '../../../common/Map/Layers/EditorZone';
import GeoJSONs, { GEOJSON_LAYER_ID } from '../../../common/Map/Layers/GeoJSONs';
import colors from '../../../common/Map/Consts/colors';
import Modal from '../components/Modal';
import EditorForm from '../components/EditorForm';

export type SelectItemsState = CommonToolState & {
  mode: 'rectangle' | 'single' | 'polygon';
  selection: EditorEntity[];
  polygonPoints: [number, number][];
  rectangleTopLeft: [number, number] | null;
  showModal: 'info' | 'edit' | 'delete' | null;
};

export const SelectItems: Tool<SelectItemsState> = {
  id: 'select-items',
  icon: BsCursor,
  labelTranslationKey: 'Editor.tools.select-items.label',
  descriptionTranslationKeys: ['Editor.tools.select-items.description-1'],
  isDisabled(editorState: EditorState) {
    return !editorState.editorZone;
  },
  getInitialState() {
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      mode: 'single',
      selection: [],
      polygonPoints: [],
      rectangleTopLeft: null,
      showModal: null,
    };
  },
  actions: [
    [
      {
        id: 'select-all',
        icon: MdSelectAll,
        labelTranslationKey: 'Editor.tools.select-items.actions.select-all.label',
        onClick({ setState }, state, editorState) {
          setState({
            ...state,
            selection: selectInZone(clippedDataSelector(editorState)),
          });
        },
      },
      {
        id: 'unselect-all',
        icon: BiLoader,
        labelTranslationKey: 'Editor.tools.select-items.actions.unselect-all.label',
        isDisabled(state) {
          return !state.selection.length;
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            selection: [],
          });
        },
      },
      {
        id: 'show-info',
        icon: BsInfoSquare,
        labelTranslationKey: 'Editor.tools.select-items.actions.show-info.label',
        isDisabled(state) {
          return !state.selection.length;
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            showModal: 'info',
          });
        },
      },
      {
        id: 'edit-info',
        icon: FiEdit,
        labelTranslationKey: 'Editor.tools.select-items.actions.edit-info.label',
        isDisabled(state) {
          return state.selection.length !== 1;
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            showModal: 'edit',
          });
        },
      },
    ],
    [
      {
        id: 'mode-single',
        icon: BsCursor,
        labelTranslationKey: 'Editor.tools.select-items.actions.single.label',
        isActive(state) {
          return state.mode === 'single';
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'single',
          });
        },
      },
      {
        id: 'mode-rectangle',
        icon: BiSelection,
        labelTranslationKey: 'Editor.tools.select-items.actions.rectangle.label',
        isActive(state) {
          return state.mode === 'rectangle';
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'rectangle',
          });
        },
      },
      {
        id: 'mode-polygon',
        icon: FaDrawPolygon,
        labelTranslationKey: 'Editor.tools.select-items.actions.polygon.label',
        isActive(state) {
          return state.mode === 'polygon';
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'polygon',
          });
        },
      },
    ],
    [
      {
        id: 'delete-selection',
        icon: BsTrash,
        labelTranslationKey: 'Editor.tools.select-items.actions.delete-selection.label',
        isDisabled(state) {
          return !state.selection.length;
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            showModal: 'delete',
          });
        },
      },
    ],
  ],

  // Interactions:
  onClickFeature(feature, e, { setState }, toolState, editorState) {
    if (toolState.mode !== 'single') return;

    let { selection } = toolState;
    const isAlreadySelected = selection.find((item) => item.id === feature.id);

    const current = editorState.editorData.find((item) => item.id === feature.id);
    if (current) {
      if (!isAlreadySelected) {
        if (e.srcEvent.ctrlKey) {
          selection = selection.concat([current]);
        } else {
          selection = [current];
        }
      } else if (e.srcEvent.ctrlKey) {
        selection = selection.filter((item) => item.id !== feature.id);
      } else if (selection.length === 1) {
        selection = [];
      } else {
        selection = [current];
      }
    }

    setState({
      ...toolState,
      selection,
    });
  },
  onClickMap(e, { setState }, toolState, editorState) {
    const position = e.lngLat;

    if (toolState.mode === 'rectangle') {
      if (toolState.rectangleTopLeft) {
        if (isEqual(toolState.rectangleTopLeft, position)) {
          setState({ ...toolState, rectangleTopLeft: null });
        } else {
          // TODO remove the layer static variable
          setState({
            ...toolState,
            rectangleTopLeft: null,
            selection: selectInZone(editorState.editorData, {
              type: 'rectangle',
              points: [toolState.rectangleTopLeft, position],
            }),
          });
        }
      } else {
        setState({
          ...toolState,
          rectangleTopLeft: position,
        });
      }
    } else if (toolState.mode === 'polygon') {
      const points = toolState.polygonPoints;
      const lastPoint = points[points.length - 1];

      if (isEqual(lastPoint, position)) {
        if (points.length >= 3) {
          // TODO remove the layer static variable
          setState({
            ...toolState,
            polygonPoints: [],
            selection: selectInZone(editorState.editorData, {
              type: 'polygon',
              points,
            }),
          });
        }
      } else {
        setState({ ...toolState, polygonPoints: points.concat([position]) });
      }
    }
  },

  // Layers:
  getLayers({ mapStyle }, toolState) {
    let selectionZone: Zone | undefined;

    if (toolState.mode === 'rectangle' && toolState.rectangleTopLeft) {
      selectionZone = {
        type: 'rectangle',
        points: [toolState.rectangleTopLeft, toolState.mousePosition],
      };
    } else if (toolState.mode === 'polygon' && toolState.polygonPoints.length) {
      selectionZone = {
        type: 'polygon',
        points: toolState.polygonPoints.concat([toolState.mousePosition]),
      };
    }

    let labelParts =
      toolState.hovered &&
      [
        toolState.hovered.properties.RA_libelle_gare,
        toolState.hovered.properties.RA_libelle_poste,
        toolState.hovered.properties.RA_libelle_poste_metier,
        toolState.hovered.properties.OP_id_poste_metier,
        toolState.hovered.properties.track_number,
      ].filter((s) => !!s && s !== 'null');

    if (toolState.hovered && !labelParts?.length) {
      labelParts = [toolState.hovered.id];
    }

    return (
      <>
        <GeoJSONs
          colors={colors[mapStyle]}
          hoveredIDs={toolState.hovered && !selectionZone ? [toolState.hovered] : []}
          selectionIDs={toolState.selection as Item[]}
        />
        <EditorZone newZone={selectionZone} />
        {toolState.mode === 'single' && toolState.hovered && (
          <Popup
            className="popup"
            anchor="bottom"
            longitude={toolState.mousePosition[0]}
            latitude={toolState.mousePosition[1]}
            closeButton={false}
          >
            {labelParts && labelParts.map((s, i) => <div key={i}>{s}</div>)}
          </Popup>
        )}
      </>
    );
  },
  getInteractiveLayers() {
    return [GEOJSON_LAYER_ID];
  },
  getDOM({ setState, dispatch, t }, toolState) {
    switch (toolState.showModal) {
      case 'info':
        return (
          <Modal onClose={() => setState({ ...toolState, showModal: null })}>
            {toolState.selection.length === 1 ? (
              <pre>{JSON.stringify(toolState.selection[0], null, '  ')}</pre>
            ) : (
              <div>
                {t('Editor.tools.select-items.selection', { count: toolState.selection.length })}
              </div>
            )}
          </Modal>
        );
      case 'edit':
        return (
          <Modal
            onClose={() => setState({ ...toolState, showModal: null })}
            title={t('Editor.tools.select-items.edit-line')}
          >
            <EditorForm
              data={toolState.selection[0] as EditorEntity}
              onSubmit={async (data) => {
                await dispatch<any>(save({ update: [data] }));
                setState({ ...toolState, selection: [data], showModal: null });
              }}
            />
          </Modal>
        );
      case 'delete':
        return (
          <Modal
            onClose={() => setState({ ...toolState, showModal: null })}
            title={t('Editor.tools.select-items.actions.delete-selection.label')}
          >
            <p>{t('Editor.tools.select-items.actions.delete-selection.confirmation')}</p>

            <div className="">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  dispatch<any>(save({ delete: toolState.selection as EditorEntity[] }));
                  setState({ ...toolState, showModal: null });
                }}
              >
                {t('common.confirm')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setState({ ...toolState, showModal: null })}
              >
                {t('common.cancel')}
              </button>
            </div>
          </Modal>
        );
      default:
        return null;
    }
  },

  getMessages({ t }, toolState) {
    if (!toolState.selection.length) return t('Editor.tools.select-items.no-selection');
    return t('Editor.tools.select-items.selection', { count: toolState.selection.length });
  },
  getCursor(toolState, _editorState, { isDragging }) {
    if (isDragging) return 'move';
    if (toolState.mode === 'single' && toolState.hovered) return 'pointer';
    if (toolState.mode !== 'single') return 'crosshair';
    return 'default';
  },
};
