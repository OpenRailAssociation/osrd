import { BsSkipEnd } from 'react-icons/bs';
import { MdSensors } from 'react-icons/md';
import { FaMapSigns } from 'react-icons/fa';

import getPointEditionTool from './tool-factory';
import { getNewBufferStop, getNewDetector, getNewSignal } from './utils';
import { BufferStopEntity, DetectorEntity, SignalEntity } from '../../../../types';
import { BasePointEditionLayers, SignalEditionLayers } from './components';

export const SignalEditionTool = getPointEditionTool<SignalEntity>({
  layer: 'signals',
  icon: FaMapSigns,
  getNewEntity: getNewSignal,
  layersComponent: SignalEditionLayers,
  requiresAngle: true,
});

export const DetectorEditionTool = getPointEditionTool<DetectorEntity>({
  layer: 'detectors',
  icon: MdSensors,
  getNewEntity: getNewDetector,
  layersComponent: BasePointEditionLayers,
});

export const BufferStopEditionTool = getPointEditionTool<BufferStopEntity>({
  layer: 'buffer_stops',
  icon: BsSkipEnd,
  getNewEntity: getNewBufferStop,
  layersComponent: BasePointEditionLayers,
});
