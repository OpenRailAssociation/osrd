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

type GroupedTrackRangeListProps = {
  displayedRanges: ApplicableTrackRange[];
};

const GroupedTrackRangesList = ({ displayedRanges }: GroupedTrackRangeListProps) => {
  const {
    state: { routeElements, routeExtra = {} },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;

  const rangesByRoute = groupBy(displayedRanges, (currentRange) => {
    const isCurrentRange = partialIsEqual(['track', 'begin', 'end'], currentRange);
    // eslint-disable-next-line no-restricted-syntax
    for (const [routeKey, { trackRanges }] of Object.entries(routeElements)) {
      if (isCurrentRange(routeExtra[routeKey]) || trackRanges.some(isCurrentRange)) {
        return routeKey;
      }
    }
    return undefined;
  });
  return Object.entries(rangesByRoute).reduce<JSX.Element[]>((acc, [route, trackRanges], index) => {
    const routeTrackRanges = trackRanges.map((range, rangeIndex) => (
      <TrackRange
        range={range}
        index={rangeIndex}
        speedRestrictionTool
        key={`track-range-${range.track}-${range.begin}-${range.end}-${range.applicable_directions}-${rangeIndex}`}
      />
    ));
    acc.push(
      <>
        <h3 key={`route-${index}`}>{route}</h3>
        {routeTrackRanges}
      </>
    );
    return acc;
  }, []);
};

export default GroupedTrackRangesList;
