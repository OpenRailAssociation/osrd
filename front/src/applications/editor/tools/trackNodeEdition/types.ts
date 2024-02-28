import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Position } from 'geojson';

import { EndPoint, TrackNodeEntity, TrackNodeType } from 'types';
import { CommonToolState } from 'applications/editor/tools/commonToolState';

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

// Client prefered order
const trackNodeTypeOrder = [
  'link',
  'point_switch',
  'crossing',
  'single_slip_switch',
  'double_slip_switch',
];

export const useTrackNodeTypes = (infraID: number | undefined) => {
  const { data } = osrdEditoastApi.endpoints.getInfraByIdTrackNodeTypes.useQuery(
    { id: infraID as number },
    { skip: !infraID }
  );
  let orderedData = [] as TrackNodeType[];
  if (data) {
    orderedData = ([...data] as TrackNodeType[]).sort(
      (a, b) => trackNodeTypeOrder.indexOf(a.id) - trackNodeTypeOrder.indexOf(b.id)
    );
  }
  return orderedData;
};
