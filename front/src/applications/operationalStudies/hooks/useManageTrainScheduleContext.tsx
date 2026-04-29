import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { WorkerStatus } from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/types';
import getPathVoltages from 'modules/pathfinding/helpers/getPathVoltages';
import usePathfinding from 'modules/pathfinding/hooks/usePathfinding';
import type { PathfindingState } from 'modules/pathfinding/types';
import { upsertPathStepsInOPs } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainSchedule/types';
import {
  getOperationalStudiesRollingStockID,
  getPathSteps,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStep } from 'reducers/osrdconf/types';

import type { ManageTrainSchedulePathProperties } from '../types';
import { useScenarioContext } from './useScenarioContext';

type ManageTrainScheduleContext = {
  pathProperties?: ManageTrainSchedulePathProperties;
  voltageRanges: RangedValue[];
  launchPathfinding: (
    steps: (PathStep | null)[],
    rollingStockId?: number,
    options?: { isInitialization: boolean; speedLimitTag?: string | null }
  ) => void;
  pathfindingState: PathfindingState;
  workerStatus: WorkerStatus;
  /** Operational points along the path (including origin and destination) and vias added by clicking on map */
  pathStepsAndSuggestedOPs?: SuggestedOP[];
} | null;

const ManageTrainScheduleContext = createContext<ManageTrainScheduleContext>(null);

type ManageTrainScheduleContextProviderProps = { children: ReactNode };

export const ManageTrainScheduleContextProvider = ({
  children,
}: ManageTrainScheduleContextProviderProps) => {
  const pathSteps = useSelector(getPathSteps);
  const { t, i18n } = useTranslation('operational-studies');

  const rollingStockId = useSelector(getOperationalStudiesRollingStockID);
  const { workerStatus } = useScenarioContext();
  const { launchPathfinding, pathfindingState, pathProperties } = usePathfinding({
    rollingStockId,
  });

  const voltageRanges = useMemo(
    () => getPathVoltages(pathProperties?.electrifications, pathProperties?.length),
    [pathProperties]
  );

  const pathStepsAndSuggestedOPs = useMemo(() => {
    if (!pathProperties) return undefined;
    return upsertPathStepsInOPs(pathProperties.suggestedOperationalPoints, compact(pathSteps), t);
  }, [pathProperties?.suggestedOperationalPoints, pathSteps, i18n.language]);

  const providedContext = useMemo(
    () => ({
      pathProperties,
      voltageRanges,
      launchPathfinding,
      workerStatus,
      pathfindingState,
      pathStepsAndSuggestedOPs,
    }),
    [
      pathProperties,
      voltageRanges,
      launchPathfinding,
      pathfindingState,
      workerStatus,
      pathStepsAndSuggestedOPs,
    ]
  );

  return (
    <ManageTrainScheduleContext.Provider value={providedContext}>
      {children}
    </ManageTrainScheduleContext.Provider>
  );
};

export const useManageTrainScheduleContext = () => {
  const context = useContext(ManageTrainScheduleContext);
  if (!context) {
    throw new Error(
      'useManageTrainScheduleContext must be used within a ManageTrainScheduleContext'
    );
  }
  return context;
};
