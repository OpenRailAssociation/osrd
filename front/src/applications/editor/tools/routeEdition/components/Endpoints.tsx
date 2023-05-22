import Select from 'react-select';
import React, { FC, useContext, useMemo } from 'react';
import { BsArrowBarRight, BsBoxArrowInRight } from 'react-icons/bs';
import { HiSwitchVertical } from 'react-icons/hi';
import { FaFlagCheckered } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { getInfraID } from 'reducers/osrdconf/selectors';
import WayPointInput from './WayPointInput';
import {
  BufferStopEntity,
  DetectorEntity,
  DIRECTIONS,
  WayPoint,
  WayPointEntity,
} from '../../../../../types';
import { RouteState } from '../types';
import EditorContext from '../../../context';
import { getEntity } from '../../../data/api';
import EntitySumUp from '../../../components/EntitySumUp';
import TOOL_TYPES from '../../toolTypes';

export const EditEndpoints: FC<{ state: RouteState; onChange: (newState: RouteState) => void }> = ({
  state,
  onChange,
}) => {
  const { t } = useTranslation();
  const { entryPoint, exitPoint, entryPointDirection } = state;

  const options = useMemo(
    () =>
      DIRECTIONS.map((s) => ({
        value: s,
        label: t(`Editor.tools.routes-edition.directions.${s}`),
      })),
    [t]
  );
  const option = useMemo(
    () => options.find((o) => o.value === entryPointDirection) || options[0],
    [options, entryPointDirection]
  );

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
      {entryPoint && (
        <div className="d-flex flex-row align-items-baseline justify-content-center mb-2">
          <span className="mr-2">{t('Editor.tools.routes-edition.start_direction')}</span>
          <Select
            value={option}
            options={options}
            onChange={(o) => {
              if (o)
                onChange({
                  ...state,
                  entryPointDirection: o.value,
                });
            }}
          />
        </div>
      )}
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

const ExtremityDisplay: FC<WayPoint> = ({ type, id }) => {
  const { t } = useTranslation();
  const { switchTool } = useContext(EditorContext);
  const infraID = useSelector(getInfraID);

  return (
    <div className="d-flex align-items-center">
      <div className="flex-shrink-0 mr-3">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          title={t('common.open')}
          onClick={() => {
            getEntity<WayPointEntity>(infraID as number, id, type).then((entity) => {
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

export const DisplayEndpoints: FC<{
  state: RouteState;
}> = ({ state }) => {
  const { t } = useTranslation();
  const { entryPoint, exitPoint, entryPointDirection } = state;

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
