import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { ItineraryPathProperties } from 'applications/operationalStudies/types';
import type { CoreOperationalPointOnPath } from 'common/api/osrdEditoastApi';
import DotsLoader from 'common/DotsLoader';
import type { PathStepV2 } from 'reducers/osrdconf/types';

import { groupOperationalPoints } from './utils';
import WaypointGroup from './WaypointGroup';

type IntermediateWaypointsPanelProps = {
  pathSteps: PathStepV2[];
  pathProperties: ItineraryPathProperties | undefined;
  status: 'idle' | 'loading' | 'error' | 'success';
  onHide: () => void;
  onAddWaypoint: (op: CoreOperationalPointOnPath, afterStepId: string) => void;
};

const IntermediateWaypointsPanel = ({
  pathSteps,
  pathProperties,
  status,
  onHide,
  onAddWaypoint,
}: IntermediateWaypointsPanelProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.itineraryModal.intermediateWaypointsPanel',
  });

  // Name a requested step that matches no OP, mirroring the form's labels
  // (PathStepItem). The last located step is the destination; the trailing
  // placeholder has no location and is skipped.
  const { t: tMain } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const lastLocatedStepKey = pathSteps.filter((step) => step.location !== null).at(-1)?.key;
  const getRequestedLabel = (step: PathStepV2) => {
    const index = pathSteps.findIndex((s) => s.key === step.key);
    if (index === 0) return tMain('requestedOrigin');
    if (step.key === lastLocatedStepKey) return tMain('requestedDestination');
    return tMain('requestedPoint', { count: index + 1 });
  };

  // path_item_positions lines up with the located steps, in order. Pair them
  // here so the grouping can look a step's position up by id.
  const positionByStepId = useMemo(() => {
    const locatedSteps = pathSteps.filter((step) => step.location !== null);
    const positions = pathProperties?.pathItemPositions;
    if (positions?.length !== locatedSteps.length) return undefined;
    return new Map(locatedSteps.map((step, i) => [step.key, positions[i]]));
  }, [pathSteps, pathProperties]);

  const groups = useMemo(
    () =>
      groupOperationalPoints(pathProperties?.operational_points ?? [], pathSteps, positionByStepId),
    [pathProperties, pathSteps, positionByStepId]
  );

  const [collapsedStepIds, setCollapsedStepIds] = useState<Set<string>>(new Set());
  const toggleGroup = (stepId: string) =>
    setCollapsedStepIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(stepId)) next.add(stepId);
      return next;
    });

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
            <WaypointGroup
              key={group.requestedStep.key}
              group={group}
              requestedLabel={getRequestedLabel(group.requestedStep)}
              onAdd={(op) => onAddWaypoint(op, group.requestedStep.key)}
              expanded={!collapsedStepIds.has(group.requestedStep.key)}
              onToggle={() => toggleGroup(group.requestedStep.key)}
            />
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
