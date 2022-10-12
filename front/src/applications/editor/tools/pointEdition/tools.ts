import { BsSkipEnd, FaMapSigns, MdSensors } from 'react-icons/all';

import getPointEditionTool from './tool-factory';
import { getNewBufferStop, getNewDetector, getNewSignal } from './utils';
import { BufferStopEntity, DetectorEntity, SignalEntity } from '../../../../types';
import { BufferStopEditionLayers, DetectorEditionLayers, SignalEditionLayers } from './components';

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
  layersComponent: DetectorEditionLayers,
});

export const BufferStopEditionTool = getPointEditionTool<BufferStopEntity>({
  layer: 'buffer_stops',
  icon: BsSkipEnd,
  getNewEntity: getNewBufferStop,
  layersComponent: BufferStopEditionLayers,
});
