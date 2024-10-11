import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@osrd-project/ui-core';
import { KebabHorizontal, X } from '@osrd-project/ui-icons';
import { Manchette } from '@osrd-project/ui-manchette';
import { useManchettesWithSpaceTimeChart } from '@osrd-project/ui-manchette-with-spacetimechart';
import { SpaceTimeChart, PathLayer } from '@osrd-project/ui-spacetimechart';

import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { OperationalPointExtensions, OperationalPointPart } from 'common/api/osrdEditoastApi';

type ManchetteWithSpaceTimeChartProps = {
  operationalPoints: {
    extensions?: OperationalPointExtensions;
    id: string;
    part: OperationalPointPart;
    position: number;
  }[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainScheduleId?: number;
};
const DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeChartWrapper = ({
  operationalPoints,
  projectPathTrainResult,
  selectedTrainScheduleId,
}: ManchetteWithSpaceTimeChartProps) => {
  const { t } = useTranslation('simulation');

  const [heightOfManchetteWithSpaceTimeChart] = useState(DEFAULT_HEIGHT);
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);

  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchettesWithSpaceTimeChart(
    operationalPoints,
    projectPathTrainResult,
    manchetteWithSpaceTimeChartRef,
    selectedTrainScheduleId
  );

  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="manchette-space-time-chart-wrapper">
      {showSettings && (
        <div id="settings-panel" className="flex justify-end absolute">
          <div className="settings-panel-section">
            <div className="settings-panel-section-title">{t('timeSpaceChartSettings.paths')}</div>
            <div className="selection">
              <Checkbox label={t('timeSpaceChartSettings.conflicts')} />
            </div>
          </div>
          <button type="button" id="close-settings-panel" onClick={() => setShowSettings(false)}>
            <X />
          </button>
        </div>
      )}
      <div className="header">
        <button
          type="button"
          className="settings-btn"
          onClick={() => setShowSettings((current) => !current)}
        >
          <KebabHorizontal />
        </button>
      </div>
      <div className="header-separator" />
      <div
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height: `${heightOfManchetteWithSpaceTimeChart}px` }}
        onScroll={handleScroll}
      >
        <Manchette {...manchetteProps} />
        <div
          className="space-time-chart-container"
          style={{
            bottom: 0,
            left: 0,
            top: 0,
            height: `${heightOfManchetteWithSpaceTimeChart - 6}px`,
          }}
        >
          <SpaceTimeChart
            className="inset-0 absolute h-full"
            spaceOrigin={0}
            timeOrigin={Math.min(...projectPathTrainResult.map((p) => +new Date(p.departure_time)))}
            {...spaceTimeChartProps}
          >
            {spaceTimeChartProps.paths.map((path) => (
              <PathLayer key={path.id} path={path} color={path.color} />
            ))}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

export default ManchetteWithSpaceTimeChartWrapper;
