/* eslint-disable import/prefer-default-export */
import { useSelector } from 'react-redux';

import { useInfraID } from 'common/osrdContext';
import { getTrainIdUsedForProjection } from 'reducers/osrdsimulation/selectors';

export const useStoreDataForSpaceTimeChart = () => {
  const infraId = useInfraID();

  return {
    infraId,
    trainIdUsedForProjection: useSelector(getTrainIdUsedForProjection),
  };
};
