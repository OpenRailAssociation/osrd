import { useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { WaypointGroup as WaypointGroupType } from './types';
import WaypointRow from './WaypointRow';

type WaypointGroupProps = {
  group: WaypointGroupType;
  defaultExpanded?: boolean;
};

const WaypointGroup = ({ group, defaultExpanded = true }: WaypointGroupProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal.intermediateWaypointsPanel',
  });
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasIntermediates = group.intermediates.length > 0;

  return (
    <div className="intermediate-waypoints-panel__group">
      <div className="intermediate-waypoints-panel__group-header">
        {hasIntermediates ? (
          <button
            type="button"
            className="intermediate-waypoints-panel__group-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? t('collapseGroup') : t('expandGroup')}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </button>
        ) : (
          <span className="intermediate-waypoints-panel__group-toggle" aria-hidden />
        )}
        <WaypointRow op={group.requestedOp} isRequested />
      </div>
      {expanded && hasIntermediates && (
        <ul className="intermediate-waypoints-panel__group-body">
          {group.intermediates.map((op) => (
            <li key={op.opId ?? `${op.track}-${op.offsetOnTrack}-${op.positionOnPath}`}>
              <WaypointRow op={op} isRequested={false} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default WaypointGroup;
