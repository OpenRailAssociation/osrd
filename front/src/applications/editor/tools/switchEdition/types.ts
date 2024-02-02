import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Position, Point } from 'geojson';

import type { CommonToolState } from 'applications/editor/tools/types';
import { EditorEntity } from 'applications/editor/typesEditorEntity';

export const ENDPOINTS = ['BEGIN', 'END'] as const;
export type EndPoint = (typeof ENDPOINTS)[number];

type SwitchPortConnection = {
  src: string;
  dst: string;
};

// TODO : Would be better and safer if editoast was sending this type in the getSwitchTypes endpoint so we can remove all related types
export type SwitchType = {
  id: TrackNodeTypeId;
  ports: string[];
  groups: Record<string, SwitchPortConnection[]>;
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

// Client prefered order
const trackNodeTypeOrder = [
  'link',
  'point_switch',
  'crossing',
  'single_slip_switch',
  'double_slip_switch',
];

export const useSwitchTypes = (infraID: number | undefined) => {
  const { data } = osrdEditoastApi.endpoints.getInfraByIdSwitchTypes.useQuery(
    { id: infraID as number },
    { skip: !infraID }
  );
  let orderedData = [] as SwitchType[];
  if (data) {
    orderedData = ([...data] as SwitchType[]).sort(
      (a, b) => trackNodeTypeOrder.indexOf(a.id) - trackNodeTypeOrder.indexOf(b.id)
    );
  }
  return orderedData;
};
