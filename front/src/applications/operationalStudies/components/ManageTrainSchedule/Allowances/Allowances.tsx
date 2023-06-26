import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { getAllowances, getPathfindingID } from 'reducers/osrdconf/selectors';
import { lengthFromLineCoordinates } from 'utils/geometry';
import {
  StandardAllowance,
  EngineeringAllowance,
  AllowanceValue,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { AiOutlineDash } from 'react-icons/ai';
import { BsDashLg } from 'react-icons/bs';
import { updateAllowances } from 'reducers/osrdconf';
import AllowancesStandardSettings from './AllowancesStandardSettings';
import AllowancesActions from './AllowancesActions';
import AllowancesList from './AllowancesList';
import { AllowancesTypes, ManageAllowancesType, OverlapAllowancesIndexesType } from './types';
import AllowancesLinearView from './AllowancesLinearView';
import { initialStandardAllowance } from './consts';

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
  const dispatch = useDispatch();
  const pathFindingID = useSelector(getPathfindingID);
  const { data: pathFinding } = osrdEditoastApi.useGetPathfindingByIdQuery(
    { id: pathFindingID as number },
    { skip: !pathFindingID }
  );
  const pathLength = Math.round(
    lengthFromLineCoordinates(pathFinding?.geographic?.coordinates) * 1000
  );
  const allowances = useSelector(getAllowances);
  const [standardAllowance, setStandardAllowance] = useState(
    (allowances &&
      (allowances.find(
        (allowance) => allowance.allowance_type === 'standard'
      ) as StandardAllowance)) ||
      initialStandardAllowance
  );
  const [engineeringAllowances, setEngineeringAllowances] = useState(
    (allowances &&
      (allowances.filter(
        (allowance) => allowance.allowance_type === 'engineering'
      ) as EngineeringAllowance[])) ||
      []
  );
  const [standardAllowanceSelectedIndex, setStandardAllowanceSelectedIndex] = useState<
    number | undefined
  >();
  const [EngineeringAllowanceSelectedIndex, setEngineeringAllowanceSelectedIndex] = useState<
    number | undefined
  >();
  const [overlapAllowancesIndexes, setOverlapAllowancesIndexes] =
    useState<OverlapAllowancesIndexesType>([false, false]);

  const setStandardDistribution = (distribution: StandardAllowance['distribution']) => {
    setStandardAllowance({ ...standardAllowance, distribution });
  };

  const setStandardValueAndUnit = (valueAndUnit: AllowanceValue) => {
    setStandardAllowance({ ...standardAllowance, default_value: valueAndUnit });
  };

  const toggleStandardAllowanceSelectedIndex = (AllowanceIndex?: number) => {
    setStandardAllowanceSelectedIndex(
      AllowanceIndex !== standardAllowanceSelectedIndex ? AllowanceIndex : undefined
    );
  };
  const toggleEngineeringAllowanceSelectedIndex = (AllowanceIndex?: number) => {
    setEngineeringAllowanceSelectedIndex(
      AllowanceIndex !== EngineeringAllowanceSelectedIndex ? AllowanceIndex : undefined
    );
  };

  // This function manage "add" and "delete" allowance, "update" is "delete" followed by "add"
  const manageAllowance = ({
    type,
    newAllowance,
    allowanceIndexToDelete,
  }: ManageAllowancesType) => {
    if (type === AllowancesTypes.standard) {
      const newRanges =
        allowanceIndexToDelete !== undefined
          ? standardAllowance.ranges.filter((_, idx) => allowanceIndexToDelete !== idx)
          : [...standardAllowance.ranges];
      setStandardAllowance({
        ...standardAllowance,
        ranges: (newAllowance ? [...newRanges, newAllowance] : newRanges).sort(
          (a, b) => a.begin_position - b.begin_position
        ),
      });
      setStandardAllowanceSelectedIndex(undefined);
    }
    if (type === AllowancesTypes.engineering) {
      const newEngineeringAllowances =
        allowanceIndexToDelete !== undefined
          ? engineeringAllowances.filter((_, index) => index !== allowanceIndexToDelete)
          : [...engineeringAllowances];
      setEngineeringAllowances(
        (newAllowance
          ? ([...newEngineeringAllowances, newAllowance] as EngineeringAllowance[])
          : newEngineeringAllowances
        ).sort((a, b) => a.begin_position - b.begin_position)
      );
      setEngineeringAllowanceSelectedIndex(undefined);
    }
  };

  useEffect(() => {
    dispatch(updateAllowances([standardAllowance, ...engineeringAllowances]));
  }, [standardAllowance, engineeringAllowances]);

  return pathFindingID && pathLength && pathLength > 0 ? (
    <div className="operational-studies-allowances">
      <div className="allowances-container">
        <h2 className="text-uppercase text-muted mb-3 mt-1">
          {t('standardAllowance')}
          <small className="ml-2">
            {t('allowancesCount', { count: standardAllowance.ranges.length })}
          </small>
        </h2>
        <div className="subtitle mb-1">
          <BsDashLg />
          <span className="ml-1">{t('standardAllowanceWholePath')}</span>
        </div>
        <AllowancesStandardSettings
          distribution={standardAllowance.distribution}
          valueAndUnit={standardAllowance.default_value}
          setDistribution={setStandardDistribution}
          setValueAndUnit={setStandardValueAndUnit}
        />
        <div className="subtitle mb-1 mt-2">
          <AiOutlineDash />
          <span className="ml-1">{t('standardAllowanceByIntervals')}</span>
        </div>
        <AllowancesActions
          allowances={standardAllowance.ranges}
          pathLength={pathLength}
          manageAllowance={manageAllowance}
          type={AllowancesTypes.standard}
          allowanceSelectedIndex={standardAllowanceSelectedIndex}
          setAllowanceSelectedIndex={setStandardAllowanceSelectedIndex}
          setOverlapAllowancesIndexes={setOverlapAllowancesIndexes}
          pathFindingSteps={pathFinding?.steps}
        />
        <AllowancesLinearView
          allowances={standardAllowance.ranges}
          pathLength={pathLength}
          allowanceSelectedIndex={standardAllowanceSelectedIndex}
          setAllowanceSelectedIndex={toggleStandardAllowanceSelectedIndex}
          globalDistribution={standardAllowance.distribution}
        />
        <AllowancesList
          allowances={standardAllowance.ranges}
          type={AllowancesTypes.standard}
          allowanceSelectedIndex={standardAllowanceSelectedIndex}
          setAllowanceSelectedIndex={toggleStandardAllowanceSelectedIndex}
          overlapAllowancesIndexes={overlapAllowancesIndexes}
        />
      </div>
      <div className="allowances-container">
        <h2 className="text-uppercase text-muted mb-3 mt-1">
          {t('engineeringAllowances')}
          <small className="ml-2">
            {t('allowancesCount', {
              count: engineeringAllowances ? engineeringAllowances.length : 0,
            })}
          </small>
        </h2>
        <AllowancesActions
          allowances={engineeringAllowances}
          pathLength={pathLength}
          manageAllowance={manageAllowance}
          type={AllowancesTypes.engineering}
          allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
          setAllowanceSelectedIndex={setEngineeringAllowanceSelectedIndex}
          pathFindingSteps={pathFinding?.steps}
        />
        <AllowancesLinearView
          allowances={engineeringAllowances}
          pathLength={pathLength}
          allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
          setAllowanceSelectedIndex={toggleEngineeringAllowanceSelectedIndex}
        />
        <AllowancesList
          allowances={engineeringAllowances}
          type={AllowancesTypes.engineering}
          allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
          setAllowanceSelectedIndex={toggleEngineeringAllowanceSelectedIndex}
        />
      </div>
    </div>
  ) : (
    <MissingPathFindingMessage />
  );
}
