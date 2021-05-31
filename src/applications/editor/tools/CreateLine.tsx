import React from 'react';
import { isEqual } from 'lodash';
import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineLeftCircle,
  MdShowChart,
} from 'react-icons/all';

import { CommonToolState, DEFAULT_COMMON_TOOL_STATE, Tool } from '../tools';
import { EditorState, createLine } from '../../../reducers/editor';
import EditorZone from '../../../common/Map/Layers/EditorZone';
import GeoJSONs from '../../../common/Map/Layers/GeoJSONs';
import colors from '../../../common/Map/Consts/colors';
import Modal from '../components/Modal';

export type CreateLineState = CommonToolState & {
  linePoints: [number, number][];
  showPropertiesModal: boolean;
  lineProperties: string;
};

export const CreateLine: Tool<CreateLineState> = {
  // Zone selection:
  id: 'create-line',
  icon: MdShowChart,
  labelTranslationKey: 'Editor.tools.create-line.label',
  descriptionTranslationKeys: [
    'Editor.tools.create-line.description-1',
    'Editor.tools.create-line.description-2',
    'Editor.tools.create-line.description-3',
    'Editor.tools.create-line.description-4',
    'Editor.tools.create-line.description-5',
  ],
  isDisabled(editorState: EditorState) {
    return !editorState.editionZone;
  },
  getInitialState() {
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      linePoints: [],
      showPropertiesModal: false,
      lineProperties: '{}',
    };
  },
  actions: [
    [
      {
        id: 'validate-line',
        icon: AiOutlineCheckCircle,
        labelTranslationKey: 'Editor.tools.create-line.actions.validate-line.label',
        onClick({ setState }, state) {
          if (state.linePoints) {
            setState({
              ...state,
              showPropertiesModal: true,
            });
          }
        },
        isDisabled(state) {
          return !state.linePoints || state.linePoints.length < 2;
        },
      },
      {
        id: 'cancel-last-point',
        icon: AiOutlineLeftCircle,
        labelTranslationKey: 'Editor.tools.create-line.actions.cancel-last-point.label',
        onClick({ setState }, state) {
          if (state.linePoints) {
            setState({
              ...state,
              linePoints: state.linePoints.slice(0, -1),
            });
          }
        },
        isDisabled(state) {
          return !state.linePoints.length;
        },
      },
      {
        id: 'cancel-line',
        icon: AiOutlineCloseCircle,
        labelTranslationKey: 'Editor.tools.create-line.actions.cancel-line.label',
        onClick({ setState }, state) {
          if (state.linePoints) {
            setState({
              ...state,
              linePoints: [],
            });
          }
        },
        isDisabled(state) {
          return !state.linePoints.length;
        },
      },
    ],
  ],

  // Interactions:
  onClickMap(e, { setState }, toolState) {
    const position = e.lngLat;

    const points = toolState.linePoints;
    const lastPoint = points[points.length - 1];

    if (isEqual(lastPoint, position)) {
      if (points.length >= 3) {
        setState({
          ...toolState,
          showPropertiesModal: true,
        });
      }
    } else {
      setState({ ...toolState, linePoints: points.concat([position]) });
    }
  },

  // Display:
  getLayers({ mapStyle }, toolState) {
    return (
      <>
        <EditorZone
          newZone={
            toolState.linePoints.length
              ? { type: 'polygon', points: toolState.linePoints.concat([toolState.mousePosition]) }
              : undefined
          }
        />
        <GeoJSONs
          colors={colors[mapStyle]}
          idHover={
            toolState.hovered && toolState.hovered.layer === 'editor/geo-main-layer'
              ? toolState.hovered.id
              : undefined
          }
        />
      </>
    );
  },
  getDOM({ setState, dispatch, t }, toolState) {
    let isConfirmEnabled = true;

    try {
      JSON.parse(toolState.lineProperties);
    } catch (e) {
      isConfirmEnabled = false;
    }

    return toolState.showPropertiesModal ? (
      <Modal
        onClose={() => setState({ ...toolState, showPropertiesModal: false, linePoints: [] })}
        title={t('Editor.tools.create-line.label')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            dispatch<any>(createLine(toolState.linePoints, JSON.parse(toolState.lineProperties)));
            setState({ ...toolState, linePoints: [], showPropertiesModal: false });
          }}
        >
          <div className="form-group">
            <label htmlFor="new-line-properties">
              {t('Editor.tools.create-line.properties')} :
            </label>
            <div className="form-control-container">
              <textarea
                id="new-line-properties"
                className="form-control "
                value={toolState.lineProperties}
                onChange={(e) => setState({ ...toolState, lineProperties: e.target.value })}
              />
            </div>
          </div>
          <div className="text-right">
            <button type="submit" className="btn btn-primary" disabled={!isConfirmEnabled}>
              {t('common.confirm')}
            </button>
          </div>
        </form>
      </Modal>
    ) : null;
  },
};
