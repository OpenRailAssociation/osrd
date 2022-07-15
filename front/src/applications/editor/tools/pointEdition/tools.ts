import { BsSkipEnd, FaMapSigns, MdSensors } from 'react-icons/all';

import getPointEditionTool from './tool-factory';
import { getNewBufferStop, getNewDetector, getNewSignal } from './utils';
import { BufferStopEntity, DetectorEntity, SignalEntity } from '../../../../types';
import { BufferStopEditionLayers, DetectorEditionLayers, SignalEditionLayers } from './components';

export const SignalEditionTool = getPointEditionTool<SignalEntity>({
  id: 'signal',
  icon: FaMapSigns,
  getNewEntity: getNewSignal,
  layersComponent: SignalEditionLayers,
  requiresAngle: true,
});

export const DetectorEditionTool = getPointEditionTool<DetectorEntity>({
  id: 'detector',
  icon: MdSensors,
  getNewEntity: getNewDetector,
  layersComponent: DetectorEditionLayers,
});

export const BufferStopEditionTool = getPointEditionTool<BufferStopEntity>({
  id: 'buffer-stop',
  icon: BsSkipEnd,
  getNewEntity: getNewBufferStop,
  layersComponent: BufferStopEditionLayers,
});
