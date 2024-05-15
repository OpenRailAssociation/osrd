import React from 'react';

import { useSelector } from 'react-redux';

import { getStdcmV2Activated, getTrainScheduleV2Activated } from 'reducers/user/userSelectors';

import ScenarioV1 from './ScenarioV1';
import ScenarioV2 from './v2/ScenarioV2';

export default function Scenario() {
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  const stdcmV2Activated = useSelector(getStdcmV2Activated);
  const useTrainScheduleV2 = trainScheduleV2Activated || stdcmV2Activated;
  return useTrainScheduleV2 ? <ScenarioV2 /> : <ScenarioV1 />;
}
