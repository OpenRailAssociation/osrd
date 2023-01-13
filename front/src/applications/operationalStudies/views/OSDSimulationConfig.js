import React, { useEffect } from 'react';

import { useDispatch } from 'react-redux';
import { MODES } from '../consts';
import OSRDConfig from './OSRDConfig/OSRDConfig';
import { updateMode } from '../../../reducers/osrdconf';

export default function OSRDSimulationConfig() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(updateMode(MODES.simulation));
  }, []);

  return <OSRDConfig />;
}
