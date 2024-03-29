import React from 'react';

import { useSelector } from 'react-redux';

import { getTrainScheduleV2Activated } from 'reducers/user/userSelectors';

import ScenarioV1 from './ScenarioV1';
import ScenarioV2 from './v2/ScenarioV2';

export default function Scenario() {
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  return trainScheduleV2Activated ? <ScenarioV2 /> : <ScenarioV1 />;
}
