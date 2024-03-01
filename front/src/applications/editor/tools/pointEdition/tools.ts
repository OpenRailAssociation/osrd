import { BsSkipEnd } from 'react-icons/bs';
import { FaMapSigns } from 'react-icons/fa';
import { MdSensors } from 'react-icons/md';

import { BasePointEditionLayers, SignalEditionLayers } from './components';
import getPointEditionTool from './tool-factory';
import type { BufferStopEntity, DetectorEntity, SignalEntity } from './types';
import { getNewBufferStop, getNewDetector, getNewSignal } from './utils';

export const SignalEditionTool = getPointEditionTool<SignalEntity>({
  layer: 'signals',
  icon: FaMapSigns,
  getNewEntity: getNewSignal,
  layersComponent: SignalEditionLayers,
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
