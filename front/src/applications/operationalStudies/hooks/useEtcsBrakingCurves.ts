import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type EtcsBrakingCurve,
  type EtcsBrakingCurves,
  EtcsBrakingCurveType,
  EtcsBrakingType,
} from '@osrd-project/ui-charts';
import { useSelector } from 'react-redux';

import {
  type CoreEtcsBrakingCurvesResponse,
  type CoreEtcsCurves,
  osrdEditoastApi,
  type SimulationResponseSuccess,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { formatSpeedCurve } from 'modules/simulationResult/components/SpeedDistanceDiagram/helpers';
import {
  findExceptionWithOccurrenceId,
  isPacedTrain,
} from 'modules/trainSchedule/helpers/pacedTrain';
import useSelectedTrainSchedule from 'modules/trainSchedule/hooks/useSelectedTrainSchedule';
import { getSelectedTrain } from 'reducers/simulationResults/selectors';
import { isOccurrenceId, isPacedTrainId } from 'utils/trainId';

import { useScenarioContext } from './useScenarioContext';

const formatEtcsCurves = (etcsBrakingCurves: CoreEtcsBrakingCurvesResponse): EtcsBrakingCurves => {
  const { conflicts, slowdowns, stops } = etcsBrakingCurves;
  const toBrakingCurve = (curve: CoreEtcsCurves): EtcsBrakingCurve => ({
    [EtcsBrakingCurveType.IND]: curve.indication
      ? formatSpeedCurve(curve.indication.positions, curve.indication.speeds)
      : [],
    [EtcsBrakingCurveType.PS]: formatSpeedCurve(
      curve.permitted_speed.positions,
      curve.permitted_speed.speeds
    ),
    [EtcsBrakingCurveType.GUI]: formatSpeedCurve(curve.guidance.positions, curve.guidance.speeds),
  });

  return {
    [EtcsBrakingType.STOP]: stops.map(toBrakingCurve),
    [EtcsBrakingType.SLOWDOWN]: slowdowns.map(toBrakingCurve),
    [EtcsBrakingType.SPACING]: conflicts
      .filter((conflict) => conflict.conflict_type == 'Spacing')
      .map(toBrakingCurve),
    [EtcsBrakingType.ROUTING]: conflicts
      .filter((conflict) => conflict.conflict_type == 'Routing')
      .map(toBrakingCurve),
  };
};

const useEtcsBrakingCurves = (
  isEtcs: boolean,
  simulation: SimulationResponseSuccess | undefined,
  trainSchedules: TrainScheduleResponse[] | undefined
): {
  etcsBrakingCurves: EtcsBrakingCurves | undefined;
  fetchEtcsBrakingCurves: (() => Promise<void>) | undefined;
} => {
  const [getEtcsBrakingCurves] = osrdEditoastApi.endpoints.getEtcsBrakingCurves.useLazyQuery();
  const [etcsBrakingCurves, setEtcsBrakingCurves] = useState<EtcsBrakingCurves>();

  const { infraId, electricalProfileSetId } = useScenarioContext();
  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};
  const trainSchedule = useSelectedTrainSchedule(trainSchedules);
  const exception = useMemo(() => {
    if (
      !selectedTrainId ||
      !trainSchedule ||
      !isPacedTrain(trainSchedule) ||
      isPacedTrainId(selectedTrainId)
    )
      return undefined;
    if (!isOccurrenceId(selectedTrainId))
      throw new Error(`trainId ${selectedTrainId} should be a occurrence id`);
    return findExceptionWithOccurrenceId(trainSchedule.paced.exceptions, selectedTrainId);
  }, [selectedTrainId, trainSchedule]);

  const fetchEtcsBrakingCurves = useCallback(async () => {
    if (selectedTrainId) {
      const data = await getEtcsBrakingCurves({
        id: selectedTrainId,
        infraId,
        electricalProfileSetId,
        exceptionId: exception?.id ?? undefined,
      }).unwrap();
      setEtcsBrakingCurves(formatEtcsCurves(data));
    } else {
      setEtcsBrakingCurves(undefined);
    }
  }, [selectedTrainId, infraId, electricalProfileSetId, exception]);

  // Update existing curves when simulation changes
  useEffect(() => {
    if (etcsBrakingCurves) {
      fetchEtcsBrakingCurves();
    }
  }, [simulation]);

  return isEtcs
    ? { etcsBrakingCurves, fetchEtcsBrakingCurves }
    : { etcsBrakingCurves: undefined, fetchEtcsBrakingCurves: undefined };
};

export default useEtcsBrakingCurves;
