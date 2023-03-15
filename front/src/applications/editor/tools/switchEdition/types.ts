import { Position } from 'geojson';

import { CommonToolState } from '../types';
import { EndPoint, SwitchEntity } from '../../../../types';

export type PortEndPointCandidate = {
  endPoint: EndPoint;
  position: Position;
  trackSectionId: string;
  trackSectionName: string;
};

export type SwitchEditionState = CommonToolState & {
  initialEntity: Partial<SwitchEntity>;
  entity: Partial<SwitchEntity>;

  portEditionState:
    | { type: 'idle' }
    | {
        type: 'selection';
        portId: string;
        onSelect: (candidate: PortEndPointCandidate) => void;
        hoveredPoint: PortEndPointCandidate | null;
      };
};
