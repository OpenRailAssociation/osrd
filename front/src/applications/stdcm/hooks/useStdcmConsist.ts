import { useSelector } from 'react-redux';

import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { type StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';

const useStdcmConsist = () => {
  const dispatch = useAppDispatch();
  const { getTotalMass, getTotalLength, getMaxSpeed } =
    useOsrdConfSelectors() as StdcmConfSelectors;
  const { updateTotalMass, updateTotalLength, updateMaxSpeed } =
    useOsrdConfActions() as StdcmConfSliceActions;

  const totalMass = useSelector(getTotalMass);
  const onTotalMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalMassValue = Number(e.target.value);
    dispatch(updateTotalMass(totalMassValue === 0 ? undefined : totalMassValue));
  };

  const totalLength = useSelector(getTotalLength);
  const onTotalLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalLengthValue = Number(e.target.value);
    dispatch(updateTotalLength(totalLengthValue === 0 ? undefined : totalLengthValue));
  };

  const maxSpeed = useSelector(getMaxSpeed);
  const onMaxSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalMaxSpeed = Number(e.target.value);
    dispatch(updateMaxSpeed(totalMaxSpeed === 0 ? undefined : totalMaxSpeed));
  };

  return {
    totalMass,
    onTotalMassChange,
    totalLength,
    onTotalLengthChange,
    maxSpeed,
    onMaxSpeedChange,
  };
};

export default useStdcmConsist;
