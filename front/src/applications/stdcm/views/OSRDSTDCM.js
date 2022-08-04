import React, {useEffect}  from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { MODES } from '../../osrd/consts';
import OSRDConfig from '../../osrd/views/OSRDConfig/OSRDConfig';
import { updateMode } from '../../../reducers/osrdconf';

export default function OSRDSTDCM() {

  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(updateMode(MODES.stdcm))
  }, []);

  return (
    <OSRDConfig />
  );
}