import React, { type FC, useCallback, useContext, useEffect, useState } from 'react';

import { Pencil } from '@osrd-project/ui-icons';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { FaMapMarkedAlt, FaTimesCircle } from 'react-icons/fa';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { getEntity } from 'applications/editor/data/api';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { EndPointKeys } from 'applications/editor/tools/routeEdition/types';
import type {
  RouteEditionState,
  WayPoint,
  WayPointEntity,
} from 'applications/editor/tools/routeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { useInfraID } from 'common/osrdContext';
import Tipped from 'common/Tipped';
import { useAppDispatch } from 'store';
import useKeyboardShortcuts from 'utils/hooks/useKeyboardShortcuts';

import type { EndPoint } from '../../trackNodeEdition/types';

interface WayPointInputProps {
  endPoint: EndPoint;
  wayPoint?: WayPoint | null;
  onChange: (entity: WayPointEntity | null) => void;
}
const WayPointInput: FC<WayPointInputProps> = ({ endPoint, wayPoint, onChange }) => {
  const dispatch = useAppDispatch();
  const { state, setState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<RouteEditionState>;
  const { t } = useTranslation();
  const infraID = useInfraID();
  const [entityState, setEntityState] = useState<
    { type: 'data'; entity: WayPointEntity } | { type: 'loading' } | { type: 'empty' }
  >({ type: 'empty' });
  // When escape is pressed => idle
  useKeyboardShortcuts([
    {
      code: 'Escape',
      handler: () =>
        setState((prev) => ({
          ...prev,
          extremityState: { type: 'idle' },
        })),
    },
  ]);

  const isPicking =
    state.extremityState.type === 'selection' && state.extremityState.extremity === endPoint;
  const isDisabled =
    state.extremityState.type === 'selection' &&
    !isPicking &&
    state.extremityState.extremity !== endPoint;

  const isWayPointSelected = !isNil(wayPoint);

  const onBtnClick = useCallback(() => {
    // Cancel current selection:
    if (isPicking) {
      setState({
        ...state,
        extremityState: {
          type: 'idle',
        },
      });
    }
    // Start selecting:
    else {
      setState({
        ...state,
        isComplete: false,
        extremityState: {
          type: 'selection',
          extremity: endPoint,
          hoveredPoint: null,
          onSelect: onChange,
        },
      });
    }
  }, [endPoint, isPicking, setState, state]);

  const getButtonIcon = () => {
    if (!isPicking && isWayPointSelected) return <Pencil />;
    return isPicking ? <FaTimesCircle /> : <FaMapMarkedAlt />;
  };

  useEffect(() => {
    if (
      entityState.type === 'empty' ||
      (entityState.type === 'data' && wayPoint?.id !== entityState.entity.properties.id)
    ) {
      if (wayPoint && wayPoint.id !== NEW_ENTITY_ID) {
        setEntityState({ type: 'loading' });
        getEntity<WayPointEntity>(infraID as number, wayPoint.id, wayPoint.type, dispatch)
          .then((entity) => {
            setEntityState({ type: 'data', entity });
            // we call the onchange here to populate the state `extremitiesEntities`
            onChange(entity);
          })
          .catch((e) => {
            console.error(e);
            setEntityState({ type: 'empty' });
            onChange(null);
          });
      } else {
        setEntityState({ type: 'empty' });
        onChange(null);
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
            onClick={onBtnClick}
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
