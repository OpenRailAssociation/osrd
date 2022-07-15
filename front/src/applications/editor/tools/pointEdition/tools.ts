import { FaMapSigns } from 'react-icons/all';

import { getNewSignal } from './utils';
import getPointEditionTool from './tool-factory';
import { SignalEntity } from '../../../../types';
import { SignalEditionLayers } from './components';

export const SignalEditionTool = getPointEditionTool<SignalEntity>({
  id: 'signal',
  icon: FaMapSigns,
  getNewEntity: getNewSignal,
  layersComponent: SignalEditionLayers,
  requiresAngle: true,
});
