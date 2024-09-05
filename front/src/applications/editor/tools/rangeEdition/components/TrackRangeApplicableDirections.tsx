import { useContext } from 'react';

import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';

import EditorContext from 'applications/editor/context';
import type {
  ApplicableDirection,
  ApplicableTrackRange,
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

import { APPLICABLE_DIRECTIONS } from '../consts';

type TrackRangeApplicableDirectionsProps = {
  index: number;
  range: ApplicableTrackRange;
  speedRestrictionTool: boolean;
};

const TrackRangeApplicableDirections = ({
  range,
  index,
  speedRestrictionTool,
}: TrackRangeApplicableDirectionsProps) => {
  const { t } = useTranslation();
  const {
    state: { entity },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<
    RangeEditionState<SpeedSectionEntity | ElectrificationEntity>
  >;
  const entityIsSpeedSection = entity.objType === 'SpeedSection';

  if (entityIsSpeedSection && !speedRestrictionTool) {
    return (
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
  }
  return t(`Editor.directions.${range.applicable_directions}`);
};

export default TrackRangeApplicableDirections;
