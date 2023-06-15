import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getPathfindingID } from 'reducers/osrdconf/selectors';
import { lengthFromLineCoordinates } from 'utils/geometry';
import { Allowance } from 'common/api/osrdEditoastApi';
import AddLine from './AddLine';
import AllowancesList from './AllowancesList';

const jsonExample = [
  {
    allowance_type: 'engineering',
    distribution: 'MARECO',
    capacity_speed_limit: 0,
    begin_position: 0,
    end_position: 150000,
    value: {
      value_type: 'time_per_distance',
      minutes: 5,
    },
  },
  {
    allowance_type: 'engineering',
    distribution: 'LINEAR',
    capacity_speed_limit: 0,
    begin_position: 150001,
    end_position: 250000,
    value: {
      value_type: 'time_per_distance',
      minutes: 5,
    },
  },
  {
    allowance_type: 'standard',
    default_value: {
      value_type: 'time_per_distance',
      minutes: 5,
    },
    ranges: [
      {
        begin_position: 0,
        end_position: 1000,
        value: {
          value_type: 'time_per_distance',
          minutes: 5,
        },
      },
    ],
    distribution: 'MARECO',
    capacity_speed_limit: 0,
  },
] as Allowance[];

const MissingPathFindingMessage = () => {
  const { t } = useTranslation('operationalStudies/allowances');
  return (
    <div className="operational-studies-allowances">
      <div className="missing-pathfinding">{t('missingPathFinding')}</div>
    </div>
  );
};

export default function Allowances() {
  const pathFindingID = useSelector(getPathfindingID);
  const { data: pathFinding } = osrdMiddlewareApi.useGetPathfindingByIdQuery(
    { id: pathFindingID as number },
    { skip: !pathFindingID }
  );
  const pathLength = Math.round(
    lengthFromLineCoordinates(pathFinding?.geographic?.coordinates) * 1000
  );
  const [allowances, setAllowances] = useState<Allowance[]>(jsonExample);

  const addAllowance = (allowance: Allowance) => {
    setAllowances([...allowances, allowance]);
  };

  return pathFindingID && pathLength && pathLength > 0 ? (
    <div className="operational-studies-allowances">
      <div className="allowances-container">
        <h2 className="text-uppercase text-muted mb-1 mt-1">Marge de régularité</h2>
        <AddLine pathLength={pathLength} addAllowance={addAllowance} type="standard" />
        <AllowancesList allowances={allowances} type="standard" />
      </div>
      <div className="allowances-container">
        <h2 className="text-uppercase text-muted mb-1 mt-1">Marges de construction</h2>
        <AddLine pathLength={pathLength} addAllowance={addAllowance} type="engineering" />
        <AllowancesList allowances={allowances} type="engineering" />
      </div>
    </div>
  ) : (
    <MissingPathFindingMessage />
  );
}
