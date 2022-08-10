import React, {useEffect}  from 'react';

import { MODES } from '../consts';
import OSRDConfig from './OSRDConfig/OSRDConfig';
import { updateMode } from '../../../reducers/osrdconf';
import { useDispatch } from 'react-redux';

export default function OSRDSimulationConfig() {

  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(updateMode(MODES.simulation))
  }, []);

  return (
    <OSRDConfig />
  );
}