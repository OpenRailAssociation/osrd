import React, { useContext, useState } from 'react';

import { groupBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { MdShowChart } from 'react-icons/md';

import EditorContext from 'applications/editor/context';
import type {
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

import TrackRange from './TrackRange';
import { compareTrackRange } from '../utils';

const DEFAULT_DISPLAYED_RANGES_COUNT = 5;

type TrackRangeListProps = {
  withRouteName?: boolean;
  speedRestrictionTool: boolean;
};

const TrackRangesList = ({ withRouteName, speedRestrictionTool }: TrackRangeListProps) => {
  const {
    state: { entity, routeElements, routeExtra = {} },
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const ranges = entity.properties.track_ranges || [];
  const displayedRanges = showAll ? ranges : ranges.slice(0, DEFAULT_DISPLAYED_RANGES_COUNT);

  function makeFullTrackList() {
    if (withRouteName) {
      const rangesByRoute = groupBy(displayedRanges, (range) => {
        const isCurrentRange = compareTrackRange(range);
        // eslint-disable-next-line no-restricted-syntax
        for (const [routeKey, { trackRanges }] of Object.entries(routeElements)) {
          if (isCurrentRange(routeExtra[routeKey]) || trackRanges.some(isCurrentRange)) {
            return routeKey;
          }
        }
        return undefined;
      });
      return Object.entries(rangesByRoute).reduce<JSX.Element[]>((acc, [route, tracks], index) => {
        const routeJSX = <h3 key={`route-${index}`}>{route}</h3>;
        const routeTracks = tracks.map((tr, trackIndex) => (
          <TrackRange
            range={tr}
            index={trackIndex}
            speedRestrictionTool={speedRestrictionTool}
            key={`track-range-${tr.track}-${tr.begin}-${tr.end}-${tr.applicable_directions}-${trackIndex}`}
          />
        ));
        return [...acc, routeJSX, ...routeTracks];
      }, []);
    }
    return displayedRanges.map((tr, trackIndex) => (
      <TrackRange
        range={tr}
        index={trackIndex}
        speedRestrictionTool={speedRestrictionTool}
        key={`track-range-${tr.track}-${tr.begin}-${tr.end}-${tr.applicable_directions}-${trackIndex}`}
      />
    ));
  }

  const fullTrackList = makeFullTrackList();

  return (
    <div>
      <h4 className="pb-2">
        <MdShowChart className="me-1" /> {t('Editor.tools.range-edition.linked-track-sections')}
      </h4>
      {displayedRanges.length === 0 ? (
        <p className="text-muted mt-3 text-center">
          {t('Editor.tools.range-edition.empty-linked-track-section')}
        </p>
      ) : (
        <ul className="list-unstyled">{fullTrackList}</ul>
      )}
      {ranges.length > DEFAULT_DISPLAYED_RANGES_COUNT && (
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-secondary w-100 text-wrap"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? t('Editor.tools.range-edition.only-show-n', {
                  count: DEFAULT_DISPLAYED_RANGES_COUNT,
                })
              : t('Editor.tools.range-edition.show-more-ranges', {
                  count: displayedRanges.length - DEFAULT_DISPLAYED_RANGES_COUNT,
                })}
          </button>
        </div>
      )}
    </div>
  );
};

export default TrackRangesList;
