import React from 'react';
import { isEqual } from 'lodash';
import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineLeftCircle,
  BiAnchor,
  MdShowChart,
} from 'react-icons/all';
import { Feature, LineString, MultiLineString, Point } from '@turf/helpers';
import { Layer, Source } from 'react-map-gl';

import { CommonToolState, DEFAULT_COMMON_TOOL_STATE, Tool } from '../tools';
import { EditorState, createEntity } from '../../../reducers/editor';
import EditorZone from '../../../common/Map/Layers/EditorZone';
import GeoJSONs, { GEOJSON_LAYER_ID } from '../../../common/Map/Layers/GeoJSONs';
import colors from '../../../common/Map/Consts/colors';
import Modal from '../components/Modal';
import { getNearestPoint } from '../../../utils/mapboxHelper';
import { EntityForm } from '../components/EntityForm';
import { EntityModel } from '../data/entity';

export type CreateLineState = CommonToolState & {
  linePoints: [number, number][];
  showPropertiesModal: boolean;
  anchorLinePoints: boolean;
  nearestPoint: Feature<Point> | null;
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
    return !editorState.editorZone;
  },
  getRadius() {
    return 50;
  },
  getInitialState() {
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      linePoints: [],
      showPropertiesModal: false,
      anchorLinePoints: true,
      nearestPoint: null,
    };
  },
  actions: [
    [
      {
        id: 'toggle-anchoring',
        icon: BiAnchor,
        labelTranslationKey: 'Editor.tools.create-line.actions.toggle-anchoring.label',
        onClick({ setState }, state) {
          setState({
            ...state,
            anchorLinePoints: !state.anchorLinePoints,
            nearestPoint: null,
          });
        },
        isActive(toolState) {
          return toolState.anchorLinePoints;
        },
      },
    ],
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
    const position: [number, number] =
      toolState.anchorLinePoints && toolState.nearestPoint
        ? (toolState.nearestPoint.geometry.coordinates as [number, number])
        : e.lngLat;

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
  onHover(e, { setState }, toolState) {
    if (!toolState.anchorLinePoints) {
      return;
    }

    if (e.features && e.features.length) {
      const nearestPoint = getNearestPoint(
        e.features as Feature<LineString | MultiLineString>[],
        e.lngLat,
      );
      setState({ ...toolState, nearestPoint });
    } else {
      setState({ ...toolState, nearestPoint: null });
    }
  },

  // Display:
  getLayers({ mapStyle }, toolState) {
    const lastPosition: [number, number] =
      toolState.anchorLinePoints && toolState.nearestPoint
        ? (toolState.nearestPoint.geometry.coordinates as [number, number])
        : toolState.mousePosition;

    return (
      <>
        <EditorZone
          newZone={
            toolState.linePoints.length
              ? { type: 'polygon', points: toolState.linePoints.concat([lastPosition]) }
              : undefined
          }
        />
        <GeoJSONs colors={colors[mapStyle]} />

        {toolState.nearestPoint && (
          <Source type="geojson" data={toolState.nearestPoint}>
            <Layer
              type="circle"
              paint={{
                'circle-radius': 4,
                'circle-color': '#ffffff',
                'circle-stroke-color': '#009EED',
                'circle-stroke-width': 1,
              }}
            />
          </Source>
        )}
      </>
    );
  },
  getDOM({ setState, dispatch, t }, toolState, editorState) {
    // Create the entity model
    const entity = new EntityModel(
      'track_section',
      editorState.editorEntitiesDefinition,
      editorState.editorComponentsDefinition,
    );
    // Set the geo
    entity.setGeometry({
      type: 'LineString',
      coordinates: toolState.linePoints,
    });
    return toolState.showPropertiesModal ? (
      <Modal
        onClose={() => setState({ ...toolState, showPropertiesModal: false, linePoints: [] })}
        title={t('Editor.tools.create-line.label')}
      >
        <EntityForm
          entity={entity}
          onSubmit={(data: EntityModel) => {
            dispatch<any>(createEntity(data));
            setState({ ...toolState, linePoints: [], showPropertiesModal: false });
          }}
        />
      </Modal>
    ) : null;
  },
  getInteractiveLayers() {
    return [GEOJSON_LAYER_ID];
  },
  getCursor(toolState, editorState, { isDragging }) {
    if (isDragging) return 'move';
    return 'copy';
  },
};
