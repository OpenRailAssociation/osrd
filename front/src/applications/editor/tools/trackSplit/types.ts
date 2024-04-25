import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';

export interface TrackSplitState {
  // the traksection to split
  track: TrackSectionEntity;
  // in millimeters for editoast
  offset: number;
  // state of the component
  splitState:
    | { type: 'idle' }
    | { type: 'movePoint'; offset: number }
    | { type: 'hoverPoint' }
    | { type: 'splitLine'; offset: number };
}
