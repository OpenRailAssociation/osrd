import React, { useContext } from 'react';

import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BsArrowBarRight } from 'react-icons/bs';
import { FaFlagCheckered, FaTimes } from 'react-icons/fa';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import type {
  ApplicableDirection,
  ApplicableTrackRange,
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { LoaderFill } from 'common/Loaders';

import { APPLICABLE_DIRECTIONS } from '../consts';
import { getPointAt } from '../utils';

interface TrackRangeProps {
  index: number;
  range: ApplicableTrackRange;
  speedRestrictionTool: boolean;
}

const TrackRange = ({ range, index, speedRestrictionTool }: TrackRangeProps) => {
  const { t } = useTranslation();
  const {
    state: { entity, trackSectionsCache },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;
  const entityIsSpeedSection = entity.objType === 'SpeedSection';

  const trackState = trackSectionsCache[range.track];

  const buttons = !speedRestrictionTool && trackState?.type === 'success' && (
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

  const applicableDirectionSelect = (
    <select
      id="filterLevel"
      className="form-control"
      value={range.applicable_directions}
      onChange={(e) => {
        const newEntity = cloneDeep(entity);
        const newRange = (newEntity.properties.track_ranges || [])[index];
        newRange.applicable_directions = e.target.value as ApplicableDirection;
        setState({ entity: newEntity, hoveredItem: null });
      }}
    >
      {APPLICABLE_DIRECTIONS.map((direction) => (
        <option key={direction} value={direction}>
          {t(`Editor.directions.${direction}`)}
        </option>
      ))}
    </select>
  );
  const applicableDirection =
    entityIsSpeedSection && !speedRestrictionTool
      ? applicableDirectionSelect
      : t(`Editor.directions.${range.applicable_directions}`);
  return (
    <li
      key={`track-range-${range.track}-${range.begin}-${range.end}-${range.applicable_directions}-${index}`}
      className="mb-4 d-flex flex-row align-items-center"
    >
      {(!trackState || trackState.type === 'loading') && (
        <div className="position-relative w-100" style={{ height: 50 }}>
          <LoaderFill className="bg-transparent" />
        </div>
      )}
      {trackState?.type === 'success' && (
        <>
          {buttons}
          <div className="flex-grow-1 flex-shrink-1 ml-3">
            <EntitySumUp entity={trackState.track} />
            {applicableDirection}
          </div>
        </>
      )}
    </li>
  );
};

export default TrackRange;
