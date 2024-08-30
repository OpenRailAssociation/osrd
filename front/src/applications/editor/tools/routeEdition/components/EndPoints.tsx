import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { BsArrowBarRight } from 'react-icons/bs';
import { FaFlagCheckered } from 'react-icons/fa';
import { HiSwitchVertical } from 'react-icons/hi';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type {
  WayPointEntity,
  RouteEditionState,
} from 'applications/editor/tools/routeEdition/types';
import type { EndPoint } from 'applications/editor/tools/switchEdition/types';

import WayPointInput from './WayPointInput';

type EndpointsProps = {
  entity: RouteEditionState['entity'];
  onExtremityChange: (waypoint: WayPointEntity | null, endPoint: EndPoint) => void;
  onExtremitiesSiwtch: () => void;
};

export const Endpoints = ({
  entity,
  onExtremityChange,
  onExtremitiesSiwtch: onExtremitiesSwitch,
}: EndpointsProps) => {
  const { t } = useTranslation();

  const entryPoint = useMemo(
    () =>
      entity.properties.entry_point.id === NEW_ENTITY_ID ? null : entity.properties.entry_point,
    [entity.properties.entry_point]
  );

  const exitPoint = useMemo(
    () =>
      entity.properties.entry_point.id === NEW_ENTITY_ID ? null : entity.properties.exit_point,
    [entity.properties.exit_point]
  );

  return (
    <>
      <h5 className="mt-4">
        <BsArrowBarRight /> {t('Editor.tools.routes-edition.start')}
      </h5>
      <WayPointInput
        endPoint="BEGIN"
        wayPoint={entryPoint}
        onChange={(e) => onExtremityChange(e, 'BEGIN')}
      />

      <div className="text-center">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!entity || !entity.properties.entry_point || !entity.properties.exit_point}
          onClick={onExtremitiesSwitch}
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
        onChange={(e) => onExtremityChange(e, 'END')}
      />
    </>
  );
};

export default Endpoints;
