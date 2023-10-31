import React, { useContext } from 'react';
import { HiSwitchVertical } from 'react-icons/hi';
import { FaFlagCheckered } from 'react-icons/fa';
import { BsArrowBarRight, BsBoxArrowInRight } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import type { BufferStopEntity, DetectorEntity, WayPoint, WayPointEntity } from 'types';

import EditorContext from 'applications/editor/context';
import { getEntity } from 'applications/editor/data/api';
import TOOL_TYPES from 'applications/editor/tools/toolTypes';
import EntitySumUp from 'applications/editor/components/EntitySumUp';
import type { RouteState } from 'applications/editor/tools/routeEdition/types';
import WayPointInput from 'applications/editor/tools/routeEdition/components/WayPointInput';

import { useInfraID } from 'common/osrdContext';

interface EditEndpointsProps {
  state: RouteState;
  onChange: (newState: RouteState) => void;
}

export const EditEndpoints = ({ state, onChange }: EditEndpointsProps) => {
  const { t } = useTranslation();
  const { entryPoint, exitPoint } = state;

  return (
    <>
      <h5 className="mt-4">
        <BsArrowBarRight /> {t('Editor.tools.routes-edition.start')}
      </h5>
      <WayPointInput
        endPoint="BEGIN"
        wayPoint={entryPoint}
        onChange={(wayPoint) => onChange({ ...state, entryPoint: wayPoint })}
      />
      <div className="text-center">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!entryPoint && !exitPoint}
          onClick={() => {
            onChange({
              ...state,
              exitPoint: entryPoint,
              entryPoint: exitPoint,
            });
          }}
        >
          <HiSwitchVertical /> {t('Editor.tools.routes-edition.swap-endpoints')}
        </button>
      </div>
      <h5 className="mt-4">
        <FaFlagCheckered /> {t('Editor.tools.routes-edition.end')}
      </h5>
      <WayPointInput
        endPoint="END"
        wayPoint={exitPoint}
        onChange={(wayPoint) => onChange({ ...state, exitPoint: wayPoint })}
      />
    </>
  );
};

const ExtremityDisplay = ({ type, id }: WayPoint) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { switchTool } = useContext(EditorContext);
  const infraID = useInfraID();

  return (
    <div className="d-flex align-items-center">
      <div className="flex-shrink-0 mr-3">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          title={t('common.open')}
          onClick={() => {
            getEntity<WayPointEntity>(infraID as number, id, type, dispatch).then((entity) => {
              if (type === 'Detector') {
                switchTool({
                  toolType: TOOL_TYPES.DETECTOR_EDITION,
                  toolState: {
                    initialEntity: entity as DetectorEntity,
                    entity: entity as DetectorEntity,
                  },
                });
              } else {
                switchTool({
                  toolType: TOOL_TYPES.BUFFER_STOP_EDITION,
                  toolState: {
                    initialEntity: entity as BufferStopEntity,
                    entity: entity as BufferStopEntity,
                  },
                });
              }
            });
          }}
        >
          <BsBoxArrowInRight />
        </button>
      </div>
      <div className="flex-grow-1 flex-shrink-1">
        <EntitySumUp objType={type} id={id} />
      </div>
    </div>
  );
};

export const DisplayEndpoints = ({ entryPoint, exitPoint, entryPointDirection }: RouteState) => {
  const { t } = useTranslation();

  return (
    <>
      <h5 className="mt-4">
        <BsArrowBarRight /> {t('Editor.tools.routes-edition.start')}
      </h5>
      {entryPoint ? (
        <ExtremityDisplay id={entryPoint.id} type={entryPoint.type} />
      ) : (
        t('common.error')
      )}
      <h5 className="mt-4">{t('Editor.tools.routes-edition.start_direction')}</h5>
      <div>{t(`Editor.tools.routes-edition.directions.${entryPointDirection}`)}</div>
      <h5 className="mt-4">
        <FaFlagCheckered /> {t('Editor.tools.routes-edition.end')}
      </h5>
      {exitPoint ? <ExtremityDisplay id={exitPoint.id} type={exitPoint.type} /> : t('common.error')}
    </>
  );
};
