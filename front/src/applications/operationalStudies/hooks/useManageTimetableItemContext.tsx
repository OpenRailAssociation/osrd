import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { InfraWithState } from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/types';
import getPathVoltages from 'modules/pathfinding/helpers/getPathVoltages';
import usePathfinding from 'modules/pathfinding/hooks/usePathfinding';
import type { PathfindingState } from 'modules/pathfinding/types';
import { upsertPathStepsInOPs } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTimetableItem/types';
import {
  getOperationalStudiesRollingStockID,
  getPathSteps,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { PathStep } from 'reducers/osrdconf/types';

import type { ManageTimetableItemPathProperties } from '../types';

type ManageTimetableItemContext = {
  pathProperties?: ManageTimetableItemPathProperties;
  voltageRanges: RangedValue[];
  launchPathfinding: (
    steps: (PathStep | null)[],
    rollingStockId?: number,
    options?: { isInitialization: boolean }
  ) => void;
  pathfindingState: PathfindingState;
  infraInfo: { infra?: InfraWithState; reloadCount: number };
  /** Operational points along the path (including origin and destination) and vias added by clicking on map */
  pathStepsAndSuggestedOPs?: SuggestedOP[];
} | null;

const ManageTimetableItemContext = createContext<ManageTimetableItemContext>(null);

type ManageTimetableItemContextProviderProps = { children: ReactNode };

export const ManageTimetableItemContextProvider = ({
  children,
}: ManageTimetableItemContextProviderProps) => {
  const pathSteps = useSelector(getPathSteps);
  const { t, i18n } = useTranslation('operational-studies');

  const rollingStockId = useSelector(getOperationalStudiesRollingStockID);
  const { launchPathfinding, pathfindingState, infraInfo, pathProperties } = usePathfinding({
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
      pathfindingState,
      infraInfo,
      pathStepsAndSuggestedOPs,
    }),
    [
      pathProperties,
      voltageRanges,
      launchPathfinding,
      pathfindingState,
      infraInfo,
      pathStepsAndSuggestedOPs,
    ]
  );

  return (
    <ManageTimetableItemContext.Provider value={providedContext}>
      {children}
    </ManageTimetableItemContext.Provider>
  );
};

export const useManageTimetableItemContext = () => {
  const context = useContext(ManageTimetableItemContext);
  if (!context) {
    throw new Error(
      'useManageTimetableItemContext must be used within a ManageTimetableItemContext'
    );
  }
  return context;
};
