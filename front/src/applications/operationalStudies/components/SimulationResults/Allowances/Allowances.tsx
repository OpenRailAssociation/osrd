import React, { useEffect, useState, useCallback } from 'react';
import { Dispatch } from 'redux';
import { TFunction } from 'react-i18next';
import nextId from 'react-id-generator';

import {
  TrainSchedule,
  Allowance,
  RangeAllowance,
  EngineeringAllowance,
  StandardAllowance,
} from 'common/api/osrdMiddlewareApi';
import { updateAllowancesSettings } from 'reducers/osrdsimulation/actions';
import { OsrdSimulationState } from 'reducers/osrdsimulation/types';

import DotsLoader from 'common/DotsLoader/DotsLoader';
import { AllowanceType } from './allowancesConsts';
import StandardAllowanceDefault from './StandardAllowanceDefault';
import AllowanceComponent from './Allowance';
import EmptyLine from './EmptyLine';

interface AllowancesProps {
  toggleAllowancesDisplay: () => void;
  t: TFunction;
  dispatch: Dispatch;
  simulation: OsrdSimulationState['simulation']['present'];
  allowancesSettings: OsrdSimulationState['allowancesSettings'];
  selectedProjection: OsrdSimulationState['selectedProjection'];
  selectedTrain: OsrdSimulationState['selectedTrain'];
  persistentAllowances: TrainSchedule['allowances'];
  syncInProgress: boolean;
  mutateAllowances: (newAllowances: Allowance[]) => void;
  getAllowances: () => void;
  trainDetail: TrainSchedule;
  getAllowanceTypes: () => AllowanceType[];
}

export default function Allowances(props: AllowancesProps) {
  const {
    toggleAllowancesDisplay,
    t,
    dispatch,
    simulation,
    allowancesSettings,
    selectedProjection,
    selectedTrain,
    persistentAllowances,
    syncInProgress,
    mutateAllowances,
    getAllowances,
    trainDetail,
    getAllowanceTypes,
  } = props;

  const [allowances, setAllowances] = useState<TrainSchedule['allowances']>([]);
  const [updateAllowances, setUpdateAllowances] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const allowanceTypes = getAllowanceTypes();

  // Do not change the keys (id, label) without checking implications
  const distributionsTypes = [
    {
      id: 'LINEAR',
      label: t('distributions.linear'),
    },
    {
      id: 'MARECO',
      label: t('distributions.mareco'),
    },
  ];

  const delAllowance = (idx: number, allowanceType?: Allowance['allowance_type']) => {
    if (allowances) {
      // change to take into considerations Mareco Ones
      const newAllowances = allowances.slice();
      // First check if i is an engineering allowance
      if (allowanceType === 'engineering') {
        newAllowances.splice(idx, 1);
      } else {
        const std = newAllowances.find((a) => a.allowance_type === 'standard') as StandardAllowance;
        std?.ranges?.splice(idx, 1);
      }

      if (newAllowances?.length === 0) {
        const newAllowancesSettings = { ...allowancesSettings };
        dispatch(
          updateAllowancesSettings({
            ...newAllowancesSettings,
            [simulation.trains[selectedTrain].id]: {
              ...newAllowancesSettings[simulation.trains[selectedTrain].id],
              ecoBlocks: false,
              baseBlocks: true,
            },
          })
        );
      }
      setAllowances(newAllowances);
      setUpdateAllowances(true);
    }
  };

  useEffect(() => {
    if (allowances && updateAllowances) {
      mutateAllowances(allowances);
      setUpdateAllowances(false);
    }
  }, [allowances]);

  useEffect(() => {
    setAllowances(persistentAllowances);
  }, [persistentAllowances]);

  useEffect(() => {
    setIsUpdating(syncInProgress);
  }, [syncInProgress]);

  const standardAllowance =
    allowances &&
    (allowances.find((a) => a.allowance_type === 'standard' && a.ranges) as StandardAllowance);

  // Engineergin can be defined alone, yet its default distribution depends on eventuel defined standard margin

  const defaultEngineeringDistributionId =
    standardAllowance?.distribution || (distributionsTypes[0]?.id as Allowance['distribution']);

  const handleAddRange = useCallback(
    (range: RangeAllowance) => {
      const newAllowances = allowances ? allowances.slice() : [];
      const stdAllowance = newAllowances.find(
        (a) => a.allowance_type === 'standard'
      ) as StandardAllowance;
      stdAllowance?.ranges?.push(range);
      setAllowances(newAllowances);
      setUpdateAllowances(true);
    },
    [allowances, setAllowances, setUpdateAllowances]
  );
  const handleAddEngineeringAllowance = useCallback(
    (allowance: EngineeringAllowance) => {
      const newAllowances = allowances ? allowances.slice() : [];
      newAllowances.push(allowance);
      setAllowances(newAllowances); // This is to be resolved
      setUpdateAllowances(true);
    },
    [allowances, setAllowances, setUpdateAllowances]
  );
  const standardAllowances = (
    <>
      <div className="h2 d-flex">
        <StandardAllowanceDefault
          distributionsTypes={distributionsTypes}
          getAllowances={getAllowances}
          setIsUpdating={setIsUpdating}
          trainDetail={trainDetail}
          selectedTrain={selectedTrain}
          selectedProjection={selectedProjection}
          simulation={simulation}
          t={t}
          dispatch={dispatch}
          getAllowanceTypes={getAllowanceTypes}
        />
        <button
          type="button"
          className="ml-auto btn btn-primary btn-only-icon btn-sm"
          onClick={toggleAllowancesDisplay}
        >
          <i className="icons-arrow-up" />
        </button>
      </div>
      {standardAllowance && <div className="text-normal">{t('specificValuesOnIntervals')}</div>}

      {standardAllowance?.ranges?.map((range, idx) => (
        <AllowanceComponent<RangeAllowance>
          t={t}
          data={range}
          distribution={standardAllowance.distribution}
          allowanceType={standardAllowance.allowance_type}
          delAllowance={delAllowance}
          idx={idx}
          key={nextId()}
          selectedTrain={selectedTrain}
          simulation={simulation}
        />
      ))}

      {(trainDetail?.allowances?.find(
        (a) => a.allowance_type === 'standard' && a.ranges
      ) as StandardAllowance) && (
        <EmptyLine
          allowanceTypes={allowanceTypes}
          distributionsTypes={distributionsTypes}
          handleChange={handleAddRange}
          allowanceType="standard"
          defaultDistributionId={defaultEngineeringDistributionId}
        />
      )}
    </>
  );
  const engineeringAllowances = (
    <>
      <div className="h2 text-normal">{t('engineeringAllowances')}</div>
      <div className="row my-1 small">
        <div className="col-md-3 text-lowercase" />
        <div className="col-md-3" />
        <div className="col-md-2">{t('allowanceType')}</div>
        <div className="col-md-3">{t('units')}</div>
        <div className="col-md-1" />
      </div>
      {trainDetail?.allowances?.map((allowance, idx) => {
        if (allowance.allowance_type === 'engineering') {
          return (
            <AllowanceComponent<EngineeringAllowance>
              t={t}
              distribution={allowance.distribution}
              allowanceType={allowance.allowance_type}
              data={allowance}
              delAllowance={delAllowance}
              idx={idx}
              key={nextId()}
              selectedTrain={selectedTrain}
              simulation={simulation}
            />
          );
        }
        return null;
      })}
      <EmptyLine
        defaultDistributionId={defaultEngineeringDistributionId}
        handleChange={handleAddEngineeringAllowance}
        distributionsTypes={distributionsTypes}
        allowanceType="engineering"
        allowanceTypes={allowanceTypes}
      />
    </>
  );
  return (
    <div className="osrd-simulation-container">
      {isUpdating && (
        <div className="allowances-updating-loader">
          <DotsLoader />
        </div>
      )}
      {allowances && (
        <>
          {standardAllowances}
          <br />
          {engineeringAllowances}
        </>
      )}
    </div>
  );
}
