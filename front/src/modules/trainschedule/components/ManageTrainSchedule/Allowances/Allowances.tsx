import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { getAllowances, getPathfindingID } from 'reducers/osrdconf/selectors';
import {
  StandardAllowance,
  EngineeringAllowance,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { AiOutlineDash } from 'react-icons/ai';
import { updateAllowances } from 'reducers/osrdconf';
import cx from 'classnames';
import AllowancesStandardSettings from './AllowancesStandardSettings';
import AllowancesActions from './AllowancesActions';
import AllowancesList from './AllowancesList';
import {
  AllowanceValueForm,
  AllowancesTypes,
  EngineeringAllowanceForm,
  ManageAllowancesType,
  OverlapAllowancesIndexesType,
  StandardAllowanceForm,
} from './types';
import AllowancesLinearView from './AllowancesLinearView';
import { initialStandardAllowance } from './consts';
import getAllowanceValue from './helpers';

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
  const dispatch = useDispatch();
  const pathFindingID = useSelector(getPathfindingID);
  const { data: pathFinding } = osrdEditoastApi.useGetPathfindingByIdQuery(
    { id: pathFindingID as number },
    { skip: !pathFindingID }
  );
  const pathLength = pathFinding?.length ? Math.round(pathFinding.length) : 0;
  const allowances = useSelector(getAllowances);
  const [collapsedStandardAllowanceRanges, setCollapsedStandardAllowanceRanges] = useState(true);
  const [standardAllowance, setStandardAllowance] = useState(
    (allowances &&
      (allowances.find(
        (allowance) => allowance.allowance_type === 'standard'
      ) as StandardAllowanceForm)) ||
      initialStandardAllowance
  );
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

  const standardAllowanceValue = useMemo(
    () => getAllowanceValue(standardAllowance.default_value),
    [standardAllowance]
  );

  const setStandardDistribution = (distribution: StandardAllowance['distribution']) => {
    setStandardAllowance({ ...standardAllowance, distribution });
  };

  const setStandardValueAndUnit = (valueAndUnit: AllowanceValueForm) => {
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

  const resetFunction = (type: AllowancesTypes) => {
    if (type === AllowancesTypes.standard) {
      setStandardAllowance(initialStandardAllowance);
    }
    if (type === AllowancesTypes.standard) {
      setEngineeringAllowances([]);
    }
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

  // dispatch only the valid allowances in the store
  useEffect(() => {
    const standardAllowanceDefaultValue = getAllowanceValue(standardAllowance.default_value);
    const validStandardAllowance =
      standardAllowanceDefaultValue && standardAllowanceDefaultValue > 0
        ? [standardAllowance as StandardAllowance]
        : [];
    dispatch(
      updateAllowances([
        ...validStandardAllowance,
        ...(engineeringAllowances as EngineeringAllowance[]),
      ])
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
              setValueAndUnit={setStandardValueAndUnit}
            />
            {standardAllowanceValue !== undefined && standardAllowanceValue > 0 && (
              <>
                <button
                  className="subtitle mb-1 mt-2"
                  type="button"
                  onClick={() =>
                    setCollapsedStandardAllowanceRanges(!collapsedStandardAllowanceRanges)
                  }
                >
                  <AiOutlineDash />
                  <span className="ml-1">{t('standardAllowanceIntervals')}</span>
                  <span className={cx('ml-auto', standardAllowance.ranges.length > 0 && 'd-none')}>
                    {collapsedStandardAllowanceRanges ? (
                      <i className="icons-arrow-down" />
                    ) : (
                      <i className="icons-arrow-up" />
                    )}
                  </span>
                </button>
                {(!collapsedStandardAllowanceRanges || standardAllowance.ranges.length > 0) && (
                  <>
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
                  </>
                )}
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
              manageAllowance={manageAllowance}
              type={AllowancesTypes.engineering}
              allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
              setAllowanceSelectedIndex={setEngineeringAllowanceSelectedIndex}
              pathFindingSteps={pathFinding?.steps}
            />
            {/*
              * Temporary desactivated until new version with overlap
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
              type={AllowancesTypes.engineering}
              allowanceSelectedIndex={EngineeringAllowanceSelectedIndex}
              setAllowanceSelectedIndex={toggleEngineeringAllowanceSelectedIndex}
            />
          </div>
        </>
      ) : (
        <MissingPathFindingMessage />
      )}
    </div>
  );
}
