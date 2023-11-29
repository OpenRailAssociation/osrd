import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Position } from 'geojson';

import { EndPoint, SwitchEntity, SwitchType } from 'types';
import { CommonToolState } from 'applications/editor/tools/commonToolState';

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
