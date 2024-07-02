import React, { useContext } from 'react';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import type {
  ApplicableTrackRange,
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { LoaderFill } from 'common/Loaders';

import TrackRangeApplicableDirections from './TrackRangeApplicableDirections';
import TrackRangeButtons from './TrackRangeButtons';
import { trackRangeKey } from '../utils';

type TrackRangeProps = {
  index: number;
  trackRange: ApplicableTrackRange;
  speedRestrictionTool?: boolean;
};

const TrackRange = ({ trackRange, index, speedRestrictionTool }: TrackRangeProps) => {
  const {
    state: { trackSectionsCache },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;

  const trackState = trackSectionsCache[trackRange.track];

  const key = trackRangeKey(trackRange, index);
  if (!trackState || trackState.type === 'loading') {
    return (
      <li key={key} className="mb-4 d-flex flex-row align-items-center">
        <div className="position-relative w-100" style={{ height: 50 }}>
          <LoaderFill className="bg-transparent" />
        </div>
      </li>
    );
  }
  if (trackState.type === 'error') return null;

  return (
    <li key={key} className="mb-4 d-flex flex-row align-items-center">
      {!speedRestrictionTool && <TrackRangeButtons range={trackRange} index={index} />}
      <div className="flex-grow-1 flex-shrink-1 ml-3">
        <EntitySumUp entity={trackState.track} />
        <TrackRangeApplicableDirections
          range={trackRange}
          index={index}
          speedRestrictionTool={Boolean(speedRestrictionTool)}
        />
      </div>
    </li>
  );
};

export default TrackRange;
