import React, { FC, useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { last } from 'lodash';
import { Position } from 'geojson';
import { BsBoxArrowInRight } from 'react-icons/bs';

import EditorContext from '../../context';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import { TrackEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';
import {
  CatenaryEntity,
  EntityObjectOperationResult,
  SpeedSectionEntity,
  TrackSectionEntity,
} from '../../../../types';
import { injectGeometry } from './utils';
import { NEW_ENTITY_ID } from '../../data/utils';
import { getMap } from '../../../../reducers/map/selectors';
import { getInfraID } from '../../../../reducers/osrdconf/selectors';
import { getAttachedItems, getEntities } from '../../data/api';
import { Spinner } from '../../../../common/Loader';
import EntitySumUp from '../../components/EntitySumUp';
import { getEditCatenaryState, getEditSpeedSectionState } from '../rangeEdition/utils';
import TOOL_TYPES from '../toolTypes';
import { ExtendedEditorContextType } from '../editorContextTypes';

export const TRACK_LAYER_ID = 'trackEditionTool/new-track-path';
export const POINTS_LAYER_ID = 'trackEditionTool/new-track-points';

const TRACK_COLOR = '#666';
const TRACK_STYLE = { 'line-color': TRACK_COLOR, 'line-dasharray': [2, 1], 'line-width': 2 };
const DEFAULT_DISPLAYED_RANGES_COUNT = 3;

/**
 * Generic component to show attached ranges items of a specific type for an edited track section:
 */
export const AttachedRangesItemsList: FC<{ id: string; itemType: 'SpeedSection' | 'Catenary' }> = ({
  id,
  itemType,
}) => {
  const { t } = useTranslation();
  const infraID = useSelector(getInfraID);
  const [itemsState, setItemsState] = useState<
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'ready'; itemEntities: SpeedSectionEntity[] | CatenaryEntity[] }
    | { type: 'error'; message: string }
  >({ type: 'idle' });
  const { switchTool } = useContext(EditorContext) as ExtendedEditorContextType<unknown>;
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (itemsState.type === 'idle') {
      setItemsState({ type: 'loading' });
      getAttachedItems(`${infraID}`, id)
        .then((res: { [key: string]: string[] }) => {
          if (res[itemType]?.length) {
            getEntities(`${infraID}`, res[itemType], itemType)
              .then((entities) => {
                if (itemType === 'SpeedSection') {
                  setItemsState({
                    type: 'ready',
                    itemEntities: (res[itemType] || []).map(
                      (s) => entities[s] as SpeedSectionEntity
                    ),
                  });
                } else {
                  setItemsState({
                    type: 'ready',
                    itemEntities: (res[itemType] || []).map((s) => entities[s] as CatenaryEntity),
                  });
                }
              })
              .catch((err) => {
                setItemsState({ type: 'error', message: err.message });
              });
          } else {
            setItemsState({ type: 'ready', itemEntities: [] });
          }
        })
        .catch((err) => {
          setItemsState({ type: 'error', message: err.message });
        });
    }
  }, [itemsState]);

  useEffect(() => {
    setItemsState({ type: 'idle' });
  }, [id]);

  if (itemsState.type === 'loading' || itemsState.type === 'idle')
    return (
      <div className="loader mt-4">
        <Spinner />
      </div>
    );
  if (itemsState.type === 'error')
    return (
      <div className="form-error mt-3 mb-3">
        <p>
          {itemsState.message ||
            (itemType === 'SpeedSection'
              ? t('Editor.tools.track-edition.default-speed-sections-error')
              : t('Editor.tools.track-edition.default-catenaries-error'))}
        </p>
      </div>
    );

  return (
    <>
      {!!itemsState.itemEntities.length && (
        <>
          <ul className="list-unstyled">
            {(showAll
              ? itemsState.itemEntities
              : itemsState.itemEntities.slice(0, DEFAULT_DISPLAYED_RANGES_COUNT)
            ).map((entity: SpeedSectionEntity | CatenaryEntity) => (
              <li key={entity.properties.id} className="d-flex align-items-center mb-2">
                <div className="flex-shrink-0 mr-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    title={t('common.open')}
                    onClick={() => {
                      if (entity.objType === itemType) {
                        switchTool({
                          toolType: TOOL_TYPES.SPEED_SECTION_EDITION,
                          toolState: getEditSpeedSectionState(entity as SpeedSectionEntity),
                        });
                      } else
                        switchTool({
                          toolType: TOOL_TYPES.CATENARY_EDITION,
                          toolState: getEditCatenaryState(entity as CatenaryEntity),
                        });
                    }}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <div className="flex-grow-1 flex-shrink-1">
                  <EntitySumUp entity={entity} />
                </div>
              </li>
            ))}
          </ul>
          {itemsState.itemEntities.length > DEFAULT_DISPLAYED_RANGES_COUNT && (
            <div className="mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? t('Editor.tools.track-edition.only-show-n', {
                      count: DEFAULT_DISPLAYED_RANGES_COUNT,
                    })
                  : t('Editor.tools.track-edition.show-more-ranges', {
                      count: itemsState.itemEntities.length - DEFAULT_DISPLAYED_RANGES_COUNT,
                    })}
              </button>
            </div>
          )}
        </>
      )}
      {!itemsState.itemEntities.length && (
        <div className="text-center">
          {itemType === 'SpeedSection'
            ? t('Editor.tools.track-edition.no-linked-speed-section')
            : t('Editor.tools.track-edition.no-linked-catenary')}
        </div>
      )}
    </>
  );
};

export const TrackEditionLayers: FC = () => {
  const {
    state,
    renderingFingerprint,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<TrackEditionState>;
  const { mapStyle, layersSettings } = useSelector(getMap);

  const isAddingPointOnExistingSection =
    typeof state.nearestPoint?.properties?.sectionIndex === 'number';
  const points = state.track.geometry.coordinates;
  let additionalSegment: typeof points = [];
  if (
    points.length &&
    state.editionState.type === 'addPoint' &&
    state.mousePosition &&
    !isAddingPointOnExistingSection
  ) {
    const lastPosition =
      state.anchorLinePoints &&
      state.nearestPoint &&
      typeof state.nearestPoint.properties?.sectionIndex !== 'number'
        ? (state.nearestPoint.geometry.coordinates as [number, number])
        : state.mousePosition;

    if (state.addNewPointsAtStart) {
      additionalSegment = [lastPosition, points[0]];
    } else {
      additionalSegment = [last(points) as [number, number], lastPosition];
    }
  }

  let highlightedPoint: Position | undefined;
  if (state.editionState.type === 'movePoint') {
    if (typeof state.editionState.draggedPointIndex === 'number') {
      highlightedPoint = state.track.geometry.coordinates[state.editionState.draggedPointIndex];
    } else if (typeof state.editionState.hoveredPointIndex === 'number') {
      highlightedPoint = state.track.geometry.coordinates[state.editionState.hoveredPointIndex];
    }
  } else if (state.editionState.type === 'deletePoint') {
    if (typeof state.editionState.hoveredPointIndex === 'number') {
      highlightedPoint = state.track.geometry.coordinates[state.editionState.hoveredPointIndex];
    }
  }

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={state.track.properties.id ? [state.track.properties.id] : undefined}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
      />

      {/* Track path */}
      <Source
        type="geojson"
        data={{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: points,
          },
        }}
      >
        <Layer id={TRACK_LAYER_ID} type="line" paint={TRACK_STYLE} />
      </Source>
      {additionalSegment.length > 0 && (
        <Source
          type="geojson"
          data={{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: additionalSegment,
            },
          }}
        >
          <Layer type="line" paint={TRACK_STYLE} />
        </Source>
      )}

      {/* Highlighted nearest point from data */}
      {state.editionState.type === 'addPoint' && state.nearestPoint && (
        <Source type="geojson" data={state.nearestPoint}>
          <Layer
            type="circle"
            paint={{
              'circle-radius': 4,
              'circle-color': '#fff',
              'circle-stroke-color': '#009EED',
              'circle-stroke-width': 2,
            }}
          />
        </Source>
      )}

      {/* Track points */}
      <Source
        type="geojson"
        data={{
          type: 'FeatureCollection',
          features: points.map((point, index) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: point,
            },
            properties: { index },
          })),
        }}
      >
        <Layer
          id={POINTS_LAYER_ID}
          type="circle"
          paint={{
            'circle-radius': state.editionState.type !== 'addPoint' ? 4 : 2,
            'circle-color': '#fff',
            'circle-stroke-color': TRACK_COLOR,
            'circle-stroke-width': 1,
          }}
        />
      </Source>

      {/* Highlighted nearest point or dragged point from track */}
      <Source
        type="geojson"
        data={{
          type: 'FeatureCollection',
          features: highlightedPoint
            ? [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'Point',
                    coordinates: highlightedPoint,
                  },
                },
              ]
            : [],
        }}
      >
        <Layer
          type="circle"
          paint={{
            'circle-radius': 4,
            'circle-color': '#fff',
            'circle-stroke-color': TRACK_COLOR,
            'circle-stroke-width': 3,
          }}
        />
      </Source>
    </>
  );
};

export const TrackEditionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { state, setState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<TrackEditionState>;
  const { track } = state;
  const isNew = track.properties.id === NEW_ENTITY_ID;

  return (
    <>
      {!isNew && (
        <>
          <h3>{t('Editor.tools.track-edition.attached-speed-sections')}</h3>
          <AttachedRangesItemsList id={track.properties.id} itemType="SpeedSection" />
          <div className="border-bottom" />
          <h3>{t('Editor.tools.track-edition.attached-catenaries')}</h3>
          <AttachedRangesItemsList id={track.properties.id} itemType="Catenary" />
          <div className="border-bottom" />
        </>
      )}
      <EditorForm
        data={track}
        onSubmit={async (savedEntity) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res: any = await dispatch(
            save(
              track.properties.id !== NEW_ENTITY_ID
                ? {
                    update: [
                      {
                        source: injectGeometry(state.initialTrack),
                        target: injectGeometry(savedEntity),
                      },
                    ],
                  }
                : { create: [injectGeometry(savedEntity)] }
            )
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const operation = res[0] as EntityObjectOperationResult;
          const { id } = operation.railjson;

          if (id && id !== savedEntity.properties.id)
            setState({
              ...state,
              track: { ...track, properties: { ...track.properties, id: `${id}` } },
            });
        }}
        onChange={(newTrack) => {
          setState({ ...state, track: newTrack as TrackSectionEntity });
        }}
      >
        <div className="text-right">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={state.track.geometry.coordinates.length < 2}
          >
            {t('common.save')}
          </button>
        </div>
      </EditorForm>
    </>
  );
};

export const TrackEditionMessages: FC = () => {
  const { t, state } = useContext(EditorContext) as ExtendedEditorContextType<TrackEditionState>;

  switch (state.editionState.type) {
    case 'addPoint':
      if (!state.anchorLinePoints) return t('Editor.tools.track-edition.help.add-point');
      return t('Editor.tools.track-edition.help.add-anchor-point');
    case 'movePoint':
      if (!state.editionState.draggedPointIndex)
        return t('Editor.tools.track-edition.help.move-point');
      return t('Editor.tools.track-edition.help.move-point-end');
    case 'deletePoint':
      return t('Editor.tools.track-edition.help.delete-point');
    default:
      return null;
  }
};
