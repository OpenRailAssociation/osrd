import React, { FC, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { GoTrash } from 'react-icons/go';
import { FaMapMarkedAlt, FaTimesCircle } from 'react-icons/fa';
import { Position } from 'geojson';

import EditorContext from 'applications/editor/context';
import { EditRoutePathState, EndPointKeys } from 'applications/editor/tools/routeEdition/types';
import { getEntity } from 'applications/editor/data/api';
import EntitySumUp from 'applications/editor/components/EntitySumUp';
import Tipped from 'applications/editor/components/Tipped';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { ExtendedEditorContextType } from 'applications/editor/tools/editorContextTypes';
import { EndPoint, WayPoint, WayPointEntity } from 'types';

const WayPointInput: FC<{
  endPoint: EndPoint;
  wayPoint: WayPoint | null;
  onChange: (newWayPoint: WayPoint & { position: Position }) => void;
}> = ({ endPoint, wayPoint, onChange }) => {
  const dispatch = useDispatch();
  const { state, setState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<EditRoutePathState>;
  const { t } = useTranslation();
  const infraID = useSelector(getInfraID);
  const [entityState, setEntityState] = useState<
    { type: 'data'; entity: WayPointEntity } | { type: 'loading' } | { type: 'empty' }
  >({ type: 'empty' });

  const isPicking =
    state.extremityEditionState.type === 'selection' &&
    state.extremityEditionState.extremity === endPoint;
  const isDisabled =
    state.extremityEditionState.type === 'selection' &&
    !isPicking &&
    state.extremityEditionState.extremity !== endPoint;
  const isWayPointSelected = state.routeState[EndPointKeys[endPoint]] !== null;

  const startPickingWayPoint = useCallback(() => {
    // Cancel current selection:
    if (isPicking) {
      setState({
        ...state,
        extremityEditionState: {
          type: 'idle',
        },
      });
    }
    // Start selecting:
    else if (!isWayPointSelected) {
      setState({
        ...state,
        extremityEditionState: {
          type: 'selection',
          extremity: endPoint,
          hoveredPoint: null,
          onSelect: (newWayPoint: WayPointEntity) => {
            setState({ ...state, extremityEditionState: { type: 'idle' } });
            onChange({
              type: newWayPoint.objType,
              id: newWayPoint.properties.id,
              position: newWayPoint.geometry.coordinates,
            });
          },
        },
      });
    } else {
      setState({
        ...state,
        routeState: {
          ...state.routeState,
          [EndPointKeys[endPoint]]: null,
        },
        optionsState: { type: 'idle' },
      });
    }
  }, [endPoint, isPicking, onChange, setState, state]);

  const getButtonIcon = () => {
    if (!isPicking && isWayPointSelected) return <GoTrash />;
    return isPicking ? <FaTimesCircle /> : <FaMapMarkedAlt />;
  };

  useEffect(() => {
    if (
      entityState.type === 'empty' ||
      (entityState.type === 'data' && entityState.entity.properties.id !== wayPoint?.id)
    ) {
      if (wayPoint) {
        setEntityState({ type: 'loading' });
        getEntity<WayPointEntity>(infraID as number, wayPoint.id, wayPoint.type, dispatch).then(
          (entity) => setEntityState({ type: 'data', entity })
        );
      } else {
        setEntityState({ type: 'empty' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wayPoint]);

  return (
    <div className="mb-4">
      <div className="d-flex flex-row align-items-center mb-2">
        <div className="flex-grow-1 flex-shrink-1 mr-2">
          {entityState.type === 'data' && entityState.entity ? (
            <EntitySumUp entity={entityState.entity} />
          ) : (
            <span className="text-info font-weight-bold">
              {t('Editor.tools.routes-edition.no-waypoint-picked-yet')}
            </span>
          )}
        </div>
        <Tipped mode="left">
          <button
            type="button"
            className="btn btn-primary px-3"
            onClick={startPickingWayPoint}
            disabled={isDisabled}
          >
            {getButtonIcon()}
          </button>
          <span>
            {t(
              `Editor.tools.routes-edition.actions.pick-${EndPointKeys[endPoint].toLowerCase()}${
                isPicking ? '-cancel' : ''
              }${isWayPointSelected ? '-delete' : ''}`
            )}
          </span>
        </Tipped>
      </div>
    </div>
  );
};

export default WayPointInput;
