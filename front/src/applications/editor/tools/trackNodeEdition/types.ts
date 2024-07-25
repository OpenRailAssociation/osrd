import type { Position, Point } from 'geojson';

import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';

export const ENDPOINTS = ['BEGIN', 'END'] as const;
export type EndPoint = (typeof ENDPOINTS)[number];

type TrackNodePortConnection = {
  src: string;
  dst: string;
};

// TODO : Would be better and safer if editoast was sending this type in the getTrackNodeTypes endpoint so we can remove all related types
export type TrackNodeType = {
  id: TrackNodeTypeId;
  ports: string[];
  groups: Record<string, TrackNodePortConnection[]>;
};

export type TrackNodeTypeId =
  | 'crossing'
  | 'single_slip_switch'
  | 'double_slip_switch'
  | 'link'
  | 'point_switch';

export type TrackEndpoint = {
  endpoint: EndPoint;
  track: string;
};

export type TrackNodeEntity = EditorEntity<
  Point,
  {
    track_node_type: string;
    ports: Record<string, TrackEndpoint>;
    extensions?: {
      sncf: {
        label?: string;
      };
    };
  }
> & {
  objType: 'TrackNode';
};

export type PortEndPointCandidate = {
  endPoint: EndPoint;
  position: Position;
  trackSectionId: string;
  trackSectionName: string;
};

export type TrackNodeEditionState = CommonToolState & {
  initialEntity: Partial<TrackNodeEntity>;
  entity: Partial<TrackNodeEntity>;

  portEditionState:
    | { type: 'idle' }
    | {
        type: 'selection';
        portId: string;
        onSelect: (candidate: PortEndPointCandidate) => void;
        hoveredPoint: PortEndPointCandidate | null;
      };
};
