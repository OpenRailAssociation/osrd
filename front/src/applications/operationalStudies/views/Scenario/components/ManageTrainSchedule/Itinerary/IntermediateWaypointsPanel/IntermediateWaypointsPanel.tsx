import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import type { ItineraryPathProperties } from 'applications/operationalStudies/types';
import DotsLoader from 'common/DotsLoader';
import { formatSuggestedOperationalPoints } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { PathStepV2 } from 'reducers/osrdconf/types';

import { groupOperationalPoints } from './utils';
import WaypointGroup from './WaypointGroup';

type IntermediateWaypointsPanelProps = {
  pathSteps: PathStepV2[];
  pathProperties: ItineraryPathProperties | undefined;
  status: 'idle' | 'loading' | 'error' | 'success';
  onHide: () => void;
};

const IntermediateWaypointsPanel = ({
  pathSteps,
  pathProperties,
  status,
  onHide,
}: IntermediateWaypointsPanelProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal.intermediateWaypointsPanel',
  });

  const suggestedOps: SuggestedOP[] = useMemo(() => {
    if (!pathProperties?.operational_points || !pathProperties.geometry) return [];
    return formatSuggestedOperationalPoints(
      pathProperties.operational_points,
      pathProperties.geometry,
      pathProperties.length
    );
  }, [pathProperties]);

  const groups = useMemo(
    () => groupOperationalPoints(suggestedOps, pathSteps),
    [suggestedOps, pathSteps]
  );

  return (
    <aside
      className="intermediate-waypoints-panel"
      aria-label={t('panelTitle')}
      data-testid="intermediate-waypoints-panel"
    >
      {status === 'loading' ? (
        <div className="intermediate-waypoints-panel__loader">
          <DotsLoader />
        </div>
      ) : status === 'success' ? (
        <div className="intermediate-waypoints-panel__list">
          {groups.map((group) => (
            <WaypointGroup key={group.requestedStep.id} group={group} />
          ))}
        </div>
      ) : (
        <div className="intermediate-waypoints-panel__empty">
          <p className="intermediate-waypoints-panel__empty-message">
            {t(status === 'idle' ? 'idleMessage' : 'noWaypoint')}
          </p>
          <button
            type="button"
            className="intermediate-waypoints-panel__empty-hide"
            onClick={onHide}
          >
            {t('hide')}
          </button>
        </div>
      )}
    </aside>
  );
};

export default IntermediateWaypointsPanel;
