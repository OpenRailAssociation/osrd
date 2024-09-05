import { useContext } from 'react';

import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BsArrowBarRight } from 'react-icons/bs';
import { FaFlagCheckered, FaTimes } from 'react-icons/fa';

import EditorContext from 'applications/editor/context';
import type {
  ApplicableTrackRange,
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

import { getPointAt } from '../utils';

type TrackRangeButtonsProps = {
  index: number;
  range: ApplicableTrackRange;
};

const TrackRangeButtons = ({ range, index }: TrackRangeButtonsProps) => {
  const { t } = useTranslation();
  const {
    state: { entity, trackSectionsCache },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;
  const trackState = trackSectionsCache[range.track];

  if (trackState?.type !== 'success') {
    return null;
  }

  return (
    <div className="flex-shrink-0 mr-3 d-flex flex-column">
      <small>
        <button
          type="button"
          className="btn btn-primary btn-sm px-2 mb-1"
          aria-label={t('Editor.tools.range-edition.edit-track-range-start')}
          title={t('Editor.tools.range-edition.edit-track-range-start')}
          onClick={() => {
            setState({
              hoveredItem: null,
              interactionState: {
                type: 'moveRangeExtremity',
                rangeIndex: index,
                extremity: 'BEGIN',
              },
            });
          }}
          onMouseLeave={() => setState({ hoveredItem: null })}
          onMouseEnter={() =>
            setState({
              hoveredItem: {
                itemType: 'TrackRangeExtremity',
                track: trackState.track,
                position: getPointAt(trackState.track, range.begin),
                extremity: 'BEGIN',
              },
            })
          }
        >
          <BsArrowBarRight />
        </button>
      </small>
      <small>
        <button
          type="button"
          className="btn btn-primary btn-sm px-2 mb-1"
          aria-label={t('Editor.tools.range-edition.edit-track-range-end')}
          title={t('Editor.tools.range-edition.edit-track-range-end')}
          onClick={() => {
            setState({
              hoveredItem: null,
              interactionState: {
                type: 'moveRangeExtremity',
                rangeIndex: index,
                extremity: 'END',
              },
            });
          }}
          onMouseLeave={() => setState({ hoveredItem: null })}
          onMouseEnter={() =>
            setState({
              hoveredItem: {
                itemType: 'TrackRangeExtremity',
                track: trackState.track,
                position: getPointAt(trackState.track, range.end),
                extremity: 'END',
              },
            })
          }
        >
          <FaFlagCheckered />
        </button>
      </small>
      <small>
        <button
          type="button"
          className="btn btn-primary btn-sm px-2"
          aria-label={t('common.delete')}
          title={t('common.delete')}
          onClick={() => {
            const newEntity = cloneDeep(entity);
            newEntity.properties.track_ranges?.splice(index, 1);
            setState({ entity: newEntity, hoveredItem: null });
          }}
          onMouseLeave={() => setState({ hoveredItem: null })}
          onMouseEnter={() =>
            setState({
              hoveredItem: {
                itemType: 'TrackRange',
                track: trackState.track,
                position: getPointAt(trackState.track, trackState.track.properties.length / 2),
              },
            })
          }
        >
          <FaTimes />
        </button>
      </small>
    </div>
  );
};

export default TrackRangeButtons;
