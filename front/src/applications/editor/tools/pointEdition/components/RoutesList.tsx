import { useContext, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { BiArrowFromLeft, BiArrowToRight } from 'react-icons/bi';
import { BsBoxArrowInRight } from 'react-icons/bs';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import type { EditoastType } from 'applications/editor/consts';
import EditorContext from 'applications/editor/context';
import { getEntities } from 'applications/editor/data/api';
import TOOL_NAMES from 'applications/editor/tools/constsToolNames';
import type { RouteEntity } from 'applications/editor/tools/routeEdition/types';
import { getRouteEditionState } from 'applications/editor/tools/routeEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Spinner } from 'common/Loaders';
import { useInfraID } from 'common/osrdContext';
import { useAppDispatch } from 'store';

interface RoutesListProps {
  type: EditoastType;
  id: string;
}

/**
 * Generic component to show routes starting or ending from the edited waypoint:
 */
const RoutesList = ({ type, id }: RoutesListProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const [routesState, setRoutesState] = useState<
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'ready'; starting: RouteEntity[]; ending: RouteEntity[] }
    | { type: 'error'; message: string }
  >({ type: 'idle' });
  const { switchTool } = useContext(EditorContext) as ExtendedEditorContextType<unknown>;
  const [getRoutesFromWaypoint] =
    osrdEditoastApi.endpoints.getInfraByInfraIdRoutesAndWaypointTypeWaypointId.useLazyQuery();

  useEffect(() => {
    if (routesState.type === 'idle' && infraID) {
      if (type !== 'BufferStop' && type !== 'Detector') {
        setRoutesState({ type: 'error', message: `${type} elements are not valid waypoints.` });
      } else {
        setRoutesState({ type: 'loading' });
        getRoutesFromWaypoint({ infraId: infraID, waypointType: type, waypointId: id })
          .unwrap()
          .then(({ starting = [], ending = [] }) => {
            if (starting.length || ending.length) {
              getEntities<RouteEntity>(infraID, [...starting, ...ending], 'Route', dispatch)
                .then((entities) => {
                  setRoutesState({
                    type: 'ready',
                    starting: starting.map((routeId) => entities[routeId]),
                    ending: ending.map((routeId) => entities[routeId]),
                  });
                })
                .catch((err) => {
                  setRoutesState({ type: 'error', message: err.message });
                });
            } else {
              setRoutesState({ type: 'ready', starting: [], ending: [] });
            }
          })
          .catch((err) => {
            setRoutesState({ type: 'error', message: err.message });
          });
      }
    }
  }, [routesState]);

  useEffect(() => {
    setRoutesState({ type: 'idle' });
  }, [type, id]);

  if (routesState.type === 'loading' || routesState.type === 'idle')
    return (
      <div className="loader mt-1">
        <Spinner />
      </div>
    );
  if (routesState.type === 'error')
    return (
      <div className="form-error mt-3 mb-3">
        <p>{routesState.message || t('Editor.tools.point-edition.default-routes-error')}</p>
      </div>
    );

  return (
    <>
      {!!routesState.starting.length && (
        <div>
          <h4>
            <BiArrowFromLeft className="me-1" />{' '}
            {t('Editor.tools.point-edition.routes-starting-from')}
          </h4>
          <ul className="list-unstyled">
            {routesState.starting.map((route) => (
              <li key={route.properties.id} className="d-flex align-items-center">
                <div className="flex-shrink-0 mr-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    aria-label={t('common.open')}
                    title={t('common.open')}
                    onClick={() => {
                      switchTool({
                        toolType: TOOL_NAMES.ROUTE_EDITION,
                        toolState: getRouteEditionState(route),
                      });
                    }}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <div className="flex-grow-1 flex-shrink-1">
                  <EntitySumUp entity={route} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!routesState.ending.length && (
        <div>
          <h4>
            <BiArrowToRight className="me-1" /> {t('Editor.tools.point-edition.routes-ending-at')}
          </h4>
          <ul className="list-unstyled">
            {routesState.ending.map((route) => (
              <li key={route.properties.id} className="d-flex align-items-center">
                <div className="flex-shrink-0 mr-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    aria-label={t('common.open')}
                    title={t('common.open')}
                    onClick={() => {
                      switchTool({
                        toolType: TOOL_NAMES.ROUTE_EDITION,
                        toolState: getRouteEditionState(route),
                      });
                    }}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <div className="flex-grow-1 flex-shrink-1">
                  <EntitySumUp entity={route} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!(routesState.starting.length + routesState.ending.length) && (
        <div className="text-center">{t('Editor.tools.point-edition.no-linked-route')}</div>
      )}
    </>
  );
};

export default RoutesList;
