import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type EtcsBrakingCurve,
  type EtcsBrakingCurves,
  EtcsBrakingCurveType,
  EtcsBrakingType,
} from '@osrd-project/ui-charts';
import { useSelector } from 'react-redux';

import {
  type EtcsBrakingCurvesResponse,
  type EtcsCurves,
  osrdEditoastApi,
  type SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import { formatSpeedCurve } from 'modules/simulationResult/components/SpeedDistanceDiagram/helpers';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import useSelectedTimetableItem from 'modules/timetableItem/hooks/useSelectedTimetableItem';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';

import { useScenarioContext } from './useScenarioContext';
import { isPacedTrainResponseWithPacedTrainId, isTrainScheduleId } from '../../../utils/trainId';

const formatEtcsCurves = (etcsBrakingCurves: EtcsBrakingCurvesResponse): EtcsBrakingCurves => {
  const { conflicts, slowdowns, stops } = etcsBrakingCurves;
  const toBrakingCurve = (curve: EtcsCurves): EtcsBrakingCurve => ({
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
  simulation: SimulationResponseSuccess | undefined
): {
  etcsBrakingCurves: EtcsBrakingCurves | undefined;
  fetchEtcsBrakingCurves: (() => Promise<void>) | undefined;
} => {
  const [getEtcsBrakingCurves] = osrdEditoastApi.endpoints.getEtcsBrakingCurves.useLazyQuery();
  const [etcsBrakingCurves, setEtcsBrakingCurves] = useState<EtcsBrakingCurves>();

  const { infraId, electricalProfileSetId } = useScenarioContext();
  const selectedTrainId = useSelector(getSelectedTrainId);
  const timetableItem = useSelectedTimetableItem();
  const exception = useMemo(() => {
    if (!selectedTrainId || !timetableItem || !isPacedTrainResponseWithPacedTrainId(timetableItem))
      return undefined;
    if (isTrainScheduleId(selectedTrainId))
      throw new Error(`trainId ${selectedTrainId} should be a occurrence id`);
    return findExceptionWithOccurrenceId(timetableItem.exceptions, selectedTrainId);
  }, [selectedTrainId, timetableItem]);

  const fetchEtcsBrakingCurves = useCallback(async () => {
    if (selectedTrainId) {
      const data = await getEtcsBrakingCurves({
        id: selectedTrainId,
        infraId,
        electricalProfileSetId,
        exceptionKey: exception?.key,
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
