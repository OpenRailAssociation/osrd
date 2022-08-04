import React, {useEffect}  from 'react';

import { MODES } from '../../osrd/consts';
import OSRDConfig from '../../osrd/views/OSRDConfig/OSRDConfig';
import { updateMode } from '../../../reducers/osrdconf';
import { useDispatch } from 'react-redux';

export default function OSRDSTDCM() {

  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(updateMode(MODES.stdcm))
  }, []);

  return (
    <OSRDConfig />
  );
}