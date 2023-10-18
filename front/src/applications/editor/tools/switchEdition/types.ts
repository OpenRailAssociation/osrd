import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Position } from 'geojson';
import { useSelector } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';

import { EndPoint, SwitchEntity, SwitchType } from '../../../../types';
import { CommonToolState } from '../commonToolState';

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

export const useSwitchTypes = () => {
  const infraID = useSelector(getInfraID);
  if (infraID) {
    const { data } = osrdEditoastApi.endpoints.getInfraByIdSwitchTypes.useQuery({ id: infraID });
    return (data || []) as SwitchType[];
  }
  return [];
};
