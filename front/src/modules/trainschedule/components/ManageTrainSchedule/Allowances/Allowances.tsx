import React, { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { AiOutlineDash } from 'react-icons/ai';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { StandardAllowance, Allowance } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import AllowancesActions from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/AllowancesActions';
import AllowancesLinearView from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/AllowancesLinearView';
import AllowancesList from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/AllowancesList';
import AllowancesStandardSettings from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/AllowancesStandardSettings';
import { initialStandardAllowance } from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/consts';
import getAllowanceValue, {
  fillAllowancesWithDefaultRanges,
} from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/helpers';
import { AllowancesTypes } from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/types';
import type {
  AllowanceValueForm,
  EngineeringAllowanceForm,
  OverlapAllowancesIndexesType,
  RangeAllowanceForm,
  StandardAllowanceForm,
} from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/types';
import { useAppDispatch } from 'store';

const MissingPathFindingMessage = () => {
  const { t } = useTranslation('operationalStudies/allowances');
  return <div className="missing-pathfinding">{t('missingPathFinding')}</div>;
};

const ResetButton = ({ resetFunction }: { resetFunction: () => void }) => {
  const { t } = useTranslation('operationalStudies/allowances');
  return (
    <button className="btn btn-link ml-auto px-1" type="button" onClick={resetFunction}>
      {t('reset')}
    </button>
  );
};

export default function Allowances() {
  const { t } = useTranslation('operationalStudies/allowances');
  const dispatch = useAppDispatch();
  const { getAllowances, getPathfindingID } = useOsrdConfSelectors();
  const pathFindingID = useSelector(getPathfindingID);
  const { data: pathFinding } = osrdEditoastApi.endpoints.getPathfindingByPathfindingId.useQuery(
    { pathfindingId: pathFindingID as number },
    { skip: !pathFindingID }
  );

  const pathLength = pathFinding?.length ? pathFinding.length : 0;
  const allowances = useSelector(getAllowances);
  const [standardAllowance, setStandardAllowance] = useState(() => {
    if (allowances) {
      const tmpStandardAllowance = allowances.find(
        (allowance) => allowance.allowance_type === 'standard'
      ) as StandardAllowanceForm;
      if (tmpStandardAllowance)
        return {
          ...tmpStandardAllowance,
          ranges: fillAllowancesWithDefaultRanges(
            tmpStandardAllowance.ranges,
            tmpStandardAllowance.default_value,
            pathLength
          ),
        };
    }
    return initialStandardAllowance;
  });
  const [engineeringAllowances, setEngineeringAllowances] = useState(
    (allowances &&
      (allowances.filter(
        (allowance) => allowance.allowance_type === 'engineering'
      ) as EngineeringAllowanceForm[])) ||
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

  const [engineeringOverlapAllowancesIndexes, setEngineeringOverlapAllowancesIndexes] =
    useState<OverlapAllowancesIndexesType>([false, false]);

  const standardAllowanceValue = useMemo(
    () => getAllowanceValue(standardAllowance.default_value),
    [standardAllowance]
  );

  const { updateAllowances } = useOsrdConfActions();

  const setStandardDistribution = (distribution: StandardAllowance['distribution']) => {
    setStandardAllowance({ ...standardAllowance, distribution });
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

  const resetFunction = (type: AllowancesTypes) => {
    if (type === AllowancesTypes.standard) {
      setStandardAllowance(initialStandardAllowance);
      setStandardAllowanceSelectedIndex(undefined);
    }
    if (type === AllowancesTypes.standard) {
      setEngineeringAllowances([]);
      setEngineeringAllowanceSelectedIndex(undefined);
    }
  };

  const updateStandardAllowanceDefaultValue = (newDefaultValue: AllowanceValueForm) => {
    setStandardAllowance({ ...standardAllowance, default_value: newDefaultValue });
  };

  const updateStandardAllowances = (newStandardAllowanceRanges: RangeAllowanceForm[]) => {
    setStandardAllowance({
      ...standardAllowance,
      ranges: newStandardAllowanceRanges,
    });
    setStandardAllowanceSelectedIndex(undefined);
  };

  const updateEngineeringAllowances = (newStandardAllowanceRanges: EngineeringAllowanceForm[]) => {
    setEngineeringAllowances(newStandardAllowanceRanges);
    setEngineeringAllowanceSelectedIndex(undefined);
  };

  useEffect(() => {
    const newRanges = standardAllowance.ranges.map((allowance) =>
      allowance.isDefault ? { ...allowance, value: standardAllowance.default_value } : allowance
    );
    setStandardAllowance({ ...standardAllowance, ranges: newRanges });
  }, [standardAllowance.default_value]);

  // dispatch only the valid allowances in the store
  useEffect(() => {
    const standardAllowanceDefaultValue = getAllowanceValue(standardAllowance.default_value);
    const validStandardAllowance =
      standardAllowanceDefaultValue && standardAllowanceDefaultValue > 0
        ? [standardAllowance as StandardAllowance]
        : [];
    dispatch(
      updateAllowances([...validStandardAllowance, ...engineeringAllowances] as Allowance[])
    );
  }, [standardAllowance, engineeringAllowances]);

  return (
    <div className="operational-studies-allowances">
      {pathFindingID && pathLength > 0 ? (
        <>
          <div className="allowances-container">
            <h2 className="text-uppercase text-muted mb-3 mt-1 d-flex align-items-center">
              {t('standardAllowance')}
              <ResetButton resetFunction={() => resetFunction(AllowancesTypes.standard)} />
            </h2>
            <AllowancesStandardSettings
              distribution={standardAllowance.distribution}
              valueAndUnit={standardAllowance.default_value}
              setDistribution={setStandardDistribution}
              updateStandardAllowanceDefaultValue={updateStandardAllowanceDefaultValue}
            />
            {standardAllowanceValue !== undefined && standardAllowanceValue > 0 && (
              <>
                <div className="subtitle mb-2 mt-2">
                  <AiOutlineDash />
                  <span className="ml-1">{t('standardAllowanceIntervals')}</span>
                </div>
                <AllowancesActions
                  allowances={standardAllowance.ranges}
                  pathLength={pathLength}
                  type={AllowancesTypes.standard}
                  allowanceSelectedIndex={standardAllowanceSelectedIndex}
                  setAllowanceSelectedIndex={setStandardAllowanceSelectedIndex}
                  setOverlapAllowancesIndexes={setOverlapAllowancesIndexes}
                  pathFindingWaypoints={pathFinding?.steps}
                  updateAllowances={updateStandardAllowances}
                  defaultAllowance={standardAllowance.default_value}
                  overlapAllowancesIndexes={overlapAllowancesIndexes}
                />
                <AllowancesLinearView
                  allowances={standardAllowance.ranges}
                  defaultAllowance={standardAllowance.default_value}
                  pathLength={pathLength}
                  allowanceSelectedIndex={standardAllowanceSelectedIndex}
                  setAllowanceSelectedIndex={toggleStandardAllowanceSelectedIndex}
                  globalDistribution={standardAllowance.distribution}
                />
                <AllowancesList
                  allowances={standardAllowance.ranges}
                  allowanceSelectedIndex={standardAllowanceSelectedIndex}
                  setAllowanceSelectedIndex={toggleStandardAllowanceSelectedIndex}
                  overlapAllowancesIndexes={overlapAllowancesIndexes}
                />
              </>
            )}
          </div>
          <div className="allowances-container">
            <h2 className="text-uppercase text-muted mb-3 mt-1 d-flex align-items-center">
              {t('engineeringAllowances')}
              <small className="ml-2">
                {t('allowancesCount', {
                  count: engineeringAllowances ? engineeringAllowances.length : 0,
                })}
              </small>
              <button
                className="btn btn-link ml-auto"
                type="button"
                onClick={() => setEngineeringAllowances([])}
              >
                {t('reset')}
              </button>
            </h2>
            <AllowancesActions
              allowances={engineeringAllowances}
              pathLength={pathLength}
              updateAllowances={updateEngineeringAllowances}
              type={AllowancesTypes.engineering}
              allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
              setAllowanceSelectedIndex={setEngineeringAllowanceSelectedIndex}
              pathFindingWaypoints={pathFinding?.steps}
              overlapAllowancesIndexes={engineeringOverlapAllowancesIndexes}
              setOverlapAllowancesIndexes={setEngineeringOverlapAllowancesIndexes}
            />
            {/*
              * Temporarily disabled until new version with overlap
              *
              <AllowancesLinearView
                allowances={engineeringAllowances}
                pathLength={pathLength}
                allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
                setAllowanceSelectedIndex={toggleEngineeringAllowanceSelectedIndex}
              />
              */}
            <AllowancesList
              allowances={engineeringAllowances}
              allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
              setAllowanceSelectedIndex={toggleEngineeringAllowanceSelectedIndex}
              overlapAllowancesIndexes={engineeringOverlapAllowancesIndexes}
            />
          </div>
        </>
      ) : (
        <MissingPathFindingMessage />
      )}
    </div>
  );
}
