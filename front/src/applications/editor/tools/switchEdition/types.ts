import type { Position, Point } from 'geojson';

import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';

export const ENDPOINTS = ['BEGIN', 'END'] as const;
export type EndPoint = (typeof ENDPOINTS)[number];

export type TrackEndpoint = {
  endpoint: EndPoint;
  track: string;
};

export type SwitchEntity = EditorEntity<
  Point,
  {
    switch_type: string;
    ports: Record<string, TrackEndpoint>;
    extensions?: {
      sncf: {
        label?: string;
      };
    };
  }
> & {
  objType: 'Switch';
};

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
