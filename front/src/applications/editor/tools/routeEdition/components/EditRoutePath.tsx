import React, { FC, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import chroma from 'chroma-js';
import { Layer, LineLayer, Popup, Source } from 'react-map-gl/maplibre';
import { featureCollection } from '@turf/helpers';
import cx from 'classnames';
import { omit } from 'lodash';
import { FaFlagCheckered } from 'react-icons/fa';
import { BsArrowBarRight } from 'react-icons/bs';
import { FiSearch } from 'react-icons/fi';

import { EditorEntity, OmitLayer, RouteEntity, WayPointEntity } from 'types';
import { LoaderFill } from 'common/Loader';
import { getRoutesLineLayerProps } from 'common/Map/Layers/Routes';
import colors from 'common/Map/Consts/colors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getMapStyle } from 'reducers/map/selectors';
import EditorContext from 'applications/editor/context';
import { getEntity } from 'applications/editor/data/api';
import { nestEntity, entityToCreateOperation } from 'applications/editor/data/utils';
import {
  getCompatibleRoutesPayload,
  getEditRouteState,
  getRouteGeometries,
} from 'applications/editor/tools/routeEdition/utils';
import EntitySumUp from 'applications/editor/components/EntitySumUp';
import { ExtendedEditorContextType } from 'applications/editor/tools/editorContextTypes';
import {
  EditRoutePathState,
  OptionsStateType,
  RouteEditionState,
} from 'applications/editor/tools/routeEdition/types';
import { EditEndpoints } from './Endpoints';

export const EditRoutePathLeftPanel: FC<{ state: EditRoutePathState }> = ({ state }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [editorSave] = osrdEditoastApi.endpoints.postInfraById.useMutation({});
  const { setState } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;
  const infraID = useSelector(getInfraID);
  const [isSaving, setIsSaving] = useState(false);
  const [includeReleaseDetectors, setIncludeReleaseDetectors] = useState(true);
  const { entryPoint, exitPoint } = state.routeState;

  const [postPathfinding] = osrdEditoastApi.endpoints.postInfraByIdPathfinding.useMutation();

  const searchCandidates = useCallback(async () => {
    if (!entryPoint || !exitPoint || state.optionsState.type === 'loading') return;

    setState({
      optionsState: { type: 'loading' },
    });

    const payload = await getCompatibleRoutesPayload(
      infraID as number,
      entryPoint,
      exitPoint,
      dispatch
    );
    const candidates = await postPathfinding({ id: infraID as number, body: payload }).unwrap();

    const candidateColors = chroma
      .scale(['#321BF7CC', '#37B5F0CC', '#F0901FCC', '#F7311BCC', '#D124E0CC'])
      .mode('lch')
      .colors(candidates.length)
      .map((str) => chroma(str).css());

    const features = await getRouteGeometries(
      infraID as number,
      entryPoint,
      exitPoint,
      candidates,
      dispatch
    );

    setState({
      optionsState: {
        type: 'options',
        options: candidates.map((candidate, i) => ({
          data: candidate,
          color: candidateColors[i],
          feature: { ...features[i], properties: { color: candidateColors[i], index: i } },
        })),
      },
    });
  }, [entryPoint, exitPoint, infraID, setState, state.optionsState.type]);

  const focusedOptionIndex =
    state.optionsState.type === 'options' ? state.optionsState.focusedOptionIndex : null;

  return (
    <div className="position-relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          searchCandidates();
        }}
      >
        <legend>{t('Editor.tools.routes-edition.create-route')}</legend>
        <EditEndpoints
          state={state.routeState}
          onChange={(routeState) => setState({ ...state, routeState })}
        />
        <button
          className="btn btn-primary btn-sm mr-2 d-block w-100 text-center"
          type="submit"
          disabled={!entryPoint || !exitPoint || state.optionsState.type === 'loading'}
        >
          <FiSearch /> {t('Editor.tools.routes-edition.search-routes')}
        </button>
      </form>
      {state.optionsState.type === 'loading' && (
        <>
          <hr />
          <div className="position-relative" style={{ height: 200 }}>
            <LoaderFill className="bg-transparent" />
          </div>
        </>
      )}
      {state.optionsState.type === 'options' && (
        <>
          <hr />
          {!state.optionsState.options.length ? (
            <div className="text-muted text-center">
              {t('Editor.tools.routes-edition.routes', { count: 0 })}
            </div>
          ) : (
            <>
              <legend>
                {t('Editor.tools.routes-edition.routes', {
                  count: state.optionsState.options.length,
                })}
              </legend>
              {state.optionsState.options.map((candidate, i) => {
                const isFocused = focusedOptionIndex === i;
                const isGreyed = typeof focusedOptionIndex === 'number' && focusedOptionIndex !== i;
                return (
                  <div key={i} className="d-flex align-items-start mb-2">
                    <div
                      className="badge small mr-3 mt-2 text-center"
                      style={{ background: isGreyed ? '#ccc' : candidate.color }}
                    >
                      {i + 1}
                    </div>
                    <div className="d-flex flex-column">
                      <div className="text-sm">
                        {t('Editor.tools.routes-edition.crossed-track-ranges', {
                          count: candidate.data.track_ranges.length,
                        })}
                      </div>
                      <div className="text-sm">
                        {t('Editor.tools.routes-edition.crossed-detectors', {
                          count: candidate.data.detectors.length,
                        })}
                      </div>
                      <button
                        type="button"
                        className={cx('btn btn-sm btn-secondary mr-2', isGreyed && 'invisible')}
                        disabled={isGreyed}
                        onClick={() => {
                          if (state.optionsState.type !== 'options') return;

                          setState({
                            ...state,
                            optionsState: {
                              ...state.optionsState,
                              focusedOptionIndex: isFocused ? undefined : i,
                            },
                          });
                        }}
                      >
                        {isFocused
                          ? t('common.cancel')
                          : t('Editor.tools.routes-edition.preview-candidate')}
                      </button>
                    </div>
                  </div>
                );
              })}
              <hr />
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="include-release-detectors"
                  checked={includeReleaseDetectors}
                  disabled={typeof focusedOptionIndex !== 'number'}
                  onChange={(e) => setIncludeReleaseDetectors(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="include-release-detectors">
                  {t('Editor.tools.routes-edition.include-release-detectors')}
                </label>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary mt-4 d-block w-100"
                disabled={typeof state.optionsState.focusedOptionIndex !== 'number'}
                onClick={async () => {
                  if (state.optionsState.type !== 'options') return;

                  const candidate =
                    state.optionsState.options[state.optionsState.focusedOptionIndex as number];
                  if (!candidate) throw new Error('No valid candidate to save.');

                  setIsSaving(true);
                  const result = await editorSave({
                    id: infraID as number,
                    body: [
                      entityToCreateOperation({
                        type: 'Feature',
                        objType: 'Route',
                        properties: {
                          id: '', // will be replaced by entityToCreateOperation
                          entry_point: omit(entryPoint, 'position'),
                          exit_point: omit(exitPoint, 'position'),
                          switches_directions: candidate.data.switches_directions,
                          release_detectors: includeReleaseDetectors
                            ? candidate.data.detectors
                            : [],
                        },
                      } as RouteEntity),
                    ],
                  });
                  if ('error' in result) throw new Error(JSON.stringify(result.error));

                  if (!result.data || result.data.length !== 1 || !('railjson' in result.data[0]))
                    throw new Error('Cannot find ID of newly created route.');
                  const newRouteId = result.data[0].railjson.id;
                  if (typeof newRouteId !== 'string')
                    throw new Error('Cannot find ID of newly created route.');

                  getEntity<RouteEntity>(infraID as number, newRouteId, 'Route', dispatch).then(
                    (route) => setState(getEditRouteState(route))
                  );
                }}
              >
                {t('Editor.tools.routes-edition.save-new-route')}
              </button>
            </>
          )}
        </>
      )}
      {isSaving && <LoaderFill />}
    </div>
  );
};

export const EditRoutePathEditionLayers: FC<{ state: EditRoutePathState }> = ({
  state: {
    hovered,
    extremityEditionState,
    mousePosition,
    optionsState,
    routeState: { entryPoint, exitPoint },
  },
}) => {
  const mapStyle = useSelector(getMapStyle);
  const { t } = useTranslation();
  const lineProps = useMemo(() => {
    const layer = getRoutesLineLayerProps({ colors: colors[mapStyle] });
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-dasharray': [2, 1],
        'line-offset': ['get', 'offset'],
      },
    } as OmitLayer<LineLayer>;
  }, [mapStyle]);
  const hoveredWayPoint = useMemo(
    () =>
      hovered?.type === 'BufferStop' || hovered?.type === 'Detector'
        ? (nestEntity(hovered.renderedEntity as EditorEntity, hovered.type) as WayPointEntity)
        : null,
    [hovered?.renderedEntity, hovered?.type]
  );

  const getOptionsStateType = (optionsStateType: OptionsStateType) => {
    if (optionsStateType.type !== 'options') {
      return [];
    }
    if (typeof optionsStateType.focusedOptionIndex === 'number') {
      return [optionsStateType.options[optionsStateType.focusedOptionIndex]];
    }
    return optionsStateType.options;
  };

  const collection = useMemo(() => {
    const options = getOptionsStateType(optionsState);
    return featureCollection(
      options
        .map((opt) => ({
          ...opt.feature,
          properties: { ...opt.feature.properties, offset: opt.feature.properties.index * 2 + 3 },
        }))
        .reverse()
    );
  }, [optionsState]);

  return (
    <>
      {/* Edited route */}
      <Source type="geojson" data={collection}>
        <Layer {...lineProps} />
      </Source>

      {entryPoint && (
        <Popup
          key="entry-popup"
          className="popup"
          anchor="bottom"
          longitude={entryPoint.position[0]}
          latitude={entryPoint.position[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <small>
            <BsArrowBarRight /> {t('Editor.tools.routes-edition.start')}
          </small>
        </Popup>
      )}
      {exitPoint && (
        <Popup
          key="exit-popup"
          className="popup"
          anchor="bottom"
          longitude={exitPoint.position[0]}
          latitude={exitPoint.position[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <small>
            <FaFlagCheckered /> {t('Editor.tools.routes-edition.end')}
          </small>
        </Popup>
      )}

      {/* Hovered waypoint */}
      {extremityEditionState.type === 'selection' && hoveredWayPoint && mousePosition && (
        <Popup
          key="hover-popup"
          className="popup"
          anchor="bottom"
          longitude={mousePosition[0]}
          latitude={mousePosition[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <EntitySumUp objType={hoveredWayPoint.objType} id={hoveredWayPoint.properties.id} />
        </Popup>
      )}
    </>
  );
};
