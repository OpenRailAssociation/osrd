import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getPathfindingID } from 'reducers/osrdconf/selectors';
import { lengthFromLineCoordinates } from 'utils/geometry';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import {
  Allowance,
  RangeAllowance,
  StandardAllowance,
  EngineeringAllowance,
  AllowanceValue,
} from 'common/api/osrdEditoastApi';
import { AiOutlineDash } from 'react-icons/ai';
import { BsDashLg } from 'react-icons/bs';
import AllowancesStandardSettings from './AllowancesStandardSettings';
import AllowancesActions from './AllowancesActions';
import AllowancesList from './AllowancesList';
import { AllowancesTypes } from './types';

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
  const { t } = useTranslation('operationalStudies/allowances');
  const pathFindingID = useSelector(getPathfindingID);
  const { data: pathFinding } = osrdMiddlewareApi.useGetPathfindingByIdQuery(
    { id: pathFindingID as number },
    { skip: !pathFindingID }
  );
  const pathLength = Math.round(
    lengthFromLineCoordinates(pathFinding?.geographic?.coordinates) * 1000
  );
  const [allowances, setAllowances] = useState<Allowance[]>(jsonExample);
  const [standardAllowance, setStandardAllowance] = useState(
    allowances.find((allowance) => allowance.allowance_type === 'standard') as StandardAllowance
  );
  const [engineeringAllowances, setEngineeringAllowances] = useState(
    allowances.filter(
      (allowance) => allowance.allowance_type === 'engineering'
    ) as EngineeringAllowance[]
  );
  const [standardAllowanceSelectedIndex, setStandardAllowanceSelectedIndex] = useState<
    number | undefined
  >();
  const [EngineeringAllowanceSelectedIndex, setEngineeringAllowanceSelectedIndex] = useState<
    number | undefined
  >();

  const setDistribution = (distribution: StandardAllowance['distribution']) => {
    setStandardAllowance({ ...standardAllowance, distribution });
  };

  const setValueAndUnit = (valueAndUnit: AllowanceValue) => {
    setStandardAllowance({ ...standardAllowance, default_value: valueAndUnit });
  };

  // Add allowances
  const addAllowance = (
    newAllowance: RangeAllowance | EngineeringAllowance,
    type: AllowancesTypes
  ) => {
    if (type === AllowancesTypes.standard) {
      setStandardAllowance({
        ...standardAllowance,
        ranges: [...standardAllowance.ranges, newAllowance],
      });
    }
    if (type === AllowancesTypes.engineering) {
      const updatedAllowances = [...engineeringAllowances, newAllowance] as EngineeringAllowance[];
      setEngineeringAllowances(updatedAllowances);
    }
  };

  // Delete allowances
  const deleteStandardAllowance = (allowanceIndex: number) => {
    if (standardAllowance?.ranges) {
      setStandardAllowance({
        ...standardAllowance,
        ranges: standardAllowance.ranges.filter((_, idx) => allowanceIndex !== idx),
      });
    }
    setStandardAllowanceSelectedIndex(undefined);
  };
  const deleteEngineeringAllowance = (allowanceIndex: number) => {
    setEngineeringAllowances(engineeringAllowances.filter((_, index) => index !== allowanceIndex));
    setEngineeringAllowanceSelectedIndex(undefined);
  };

  // Update allowances

  useEffect(() => {
    setAllowances([standardAllowance, ...engineeringAllowances]);
    console.log([standardAllowance, ...engineeringAllowances]);
  }, [standardAllowance, engineeringAllowances]);

  return pathFindingID && pathLength && pathLength > 0 ? (
    <div className="operational-studies-allowances">
      <div className="allowances-container">
        <h2 className="text-uppercase text-muted mb-1 mt-1">
          {t('standardAllowance')}
          <small className="ml-2">
            {t('allowancesCount', { count: standardAllowance.ranges.length })}
          </small>
        </h2>
        <div className="subtitle mb-1 mt-2">
          <BsDashLg />
          <span className="ml-1">{t('standardAllowanceWholePath')}</span>
        </div>
        <AllowancesStandardSettings
          distribution={standardAllowance.distribution}
          valueAndUnit={standardAllowance.default_value}
          setDistribution={setDistribution}
          setValueAndUnit={setValueAndUnit}
        />
        <div className="subtitle mb-1 mt-2">
          <AiOutlineDash />
          <span className="ml-1">{t('standardAllowanceByIntervals')}</span>
        </div>
        <AllowancesActions
          allowances={standardAllowance.ranges}
          pathLength={pathLength}
          addAllowance={addAllowance}
          type={AllowancesTypes.standard}
          allowanceSelectedIndex={standardAllowanceSelectedIndex}
          setAllowanceSelectedIndex={setStandardAllowanceSelectedIndex}
          deleteAllowance={deleteStandardAllowance}
        />
        <AllowancesList
          allowances={standardAllowance.ranges}
          type={AllowancesTypes.standard}
          allowanceSelectedIndex={standardAllowanceSelectedIndex}
          setAllowanceSelectedIndex={setStandardAllowanceSelectedIndex}
        />
      </div>
      <div className="allowances-container">
        <h2 className="text-uppercase text-muted mb-1 mt-1">
          {t('engineeringAllowances')}
          <small className="ml-2">
            {t('allowancesCount', { count: engineeringAllowances.length })}
          </small>
        </h2>
        <AllowancesActions
          allowances={engineeringAllowances}
          pathLength={pathLength}
          addAllowance={addAllowance}
          type={AllowancesTypes.engineering}
          allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
          setAllowanceSelectedIndex={setEngineeringAllowanceSelectedIndex}
          deleteAllowance={deleteEngineeringAllowance}
        />
        <AllowancesList
          allowances={engineeringAllowances}
          type={AllowancesTypes.engineering}
          allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
          setAllowanceSelectedIndex={setEngineeringAllowanceSelectedIndex}
        />
      </div>
    </div>
  ) : (
    <MissingPathFindingMessage />
  );
}
