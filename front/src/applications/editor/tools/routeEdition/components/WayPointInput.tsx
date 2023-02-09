import React, { FC, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { FaMapMarkedAlt, FaTimesCircle } from 'react-icons/fa';
import { Position } from 'geojson';

import { EndPoint, WayPoint, WayPointEntity } from '../../../../../types';
import EditorContext from '../../../context';
import { ExtendedEditorContextType, OSRDConf } from '../../types';
import { EditRoutePathState } from '../types';
import { getEntity } from '../../../data/api';
import EntitySumUp from '../../../components/EntitySumUp';
import Tipped from '../../../components/Tipped';

const WayPointInput: FC<{
  endPoint: EndPoint;
  wayPoint: WayPoint | null;
  onChange: (newWayPoint: WayPoint & { position: Position }) => void;
}> = ({ endPoint, wayPoint, onChange }) => {
  const { state, setState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<EditRoutePathState>;
  const { t } = useTranslation();
  const osrdConf = useSelector(({ osrdconf }: { osrdconf: OSRDConf }) => osrdconf);
  const [entityState, setEntityState] = useState<
    { type: 'data'; entity: WayPointEntity } | { type: 'loading' } | { type: 'empty' }
  >({ type: 'empty' });

  const isPicking = state.extremityEditionState.type === 'selection';
  const isDisabled = state.extremityEditionState.type === 'selection';

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
    else if (!isDisabled) {
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
    }
  }, [endPoint, isDisabled, isPicking, onChange, setState, state]);

  useEffect(() => {
    if (
      entityState.type === 'empty' ||
      (entityState.type === 'data' && entityState.entity.properties.id !== wayPoint?.id)
    ) {
      if (wayPoint) {
        setEntityState({ type: 'loading' });
        getEntity<WayPointEntity>(osrdConf.infraID as string, wayPoint.id, wayPoint.type).then(
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
            {isPicking ? <FaTimesCircle /> : <FaMapMarkedAlt />}
          </button>
          <span>
            {t(
              `Editor.tools.routes-edition.actions.pick-${
                endPoint === 'BEGIN' ? 'entry' : 'exit'
              }point${isPicking ? '-cancel' : ''}`
            )}
          </span>
        </Tipped>
      </div>
    </div>
  );
};

export default WayPointInput;
