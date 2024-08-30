import React, { useContext } from 'react';

import { groupBy } from 'lodash';

import EditorContext from 'applications/editor/context';
import type {
  ApplicableTrackRange,
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { partialIsEqual } from 'utils/object';

import TrackRange from './TrackRange';
import { trackRangeKey } from '../utils';

type GroupedTrackRangeListProps = {
  displayedRanges: ApplicableTrackRange[];
};

const GroupedTrackRangeList = ({ displayedRanges }: GroupedTrackRangeListProps) => {
  const {
    state: { routeElements, routeExtra = {} },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;

  const rangesByRoute = groupBy(displayedRanges, (currentRange) => {
    for (const [routeKey, { trackRanges }] of Object.entries(routeElements)) {
      if (
        partialIsEqual(['track', 'begin', 'end'], currentRange, routeExtra[routeKey]) ||
        trackRanges.some((trackRange) =>
          partialIsEqual(['track', 'begin', 'end'], currentRange, trackRange)
        )
      ) {
        return routeKey;
      }
    }
    return undefined;
  });
  return Object.entries(rangesByRoute).reduce<JSX.Element[]>((acc, [route, trackRanges], index) => {
    const routeTrackRanges = trackRanges.map((trackRange, rangeIndex) => (
      <TrackRange
        trackRange={trackRange}
        index={rangeIndex}
        speedRestrictionTool
        key={trackRangeKey(trackRange, rangeIndex)}
      />
    ));
    acc.push(
      <React.Fragment key={`track-range-group-${index}`}>
        <h3 key={`route-${index}`}>{route}</h3>
        {routeTrackRanges}
      </React.Fragment>
    );
    return acc;
  }, []);
};

export default GroupedTrackRangeList;
