import type { Dispatch, SetStateAction } from 'react';

import { DEFAULT_ZOOM_MS_PER_PX, timeScaleToZoomValue } from '@osrd-project/ui-charts';
import { Iterations, Sliders, ZoomIn } from '@osrd-project/ui-icons';
import cx from 'classnames';

import type { WaypointsPanelData } from 'modules/simulationResult/types';

type SpaceTimeChartToolbarProps = {
  xZoom: number;
  handleXZoom: (newXZoom: number, xPosition?: number) => void;
  zoomMode: boolean;
  waypointsPanelData?: WaypointsPanelData;
  toggleZoomMode: () => void;
  setShowSettingsPanel: Dispatch<SetStateAction<boolean>>;
  className?: string;
};

const SpaceTimeChartToolbar = ({
  xZoom,
  handleXZoom,
  zoomMode,
  waypointsPanelData,
  toggleZoomMode,
  setShowSettingsPanel,
}: SpaceTimeChartToolbarProps) => (
  <div className="toolbar">
    <button
      data-testid="zoom-reset-button"
      type="button"
      className={cx('reset-button', {
        'reset-button-disabled': xZoom === timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX),
      })}
      onClick={() => {
        if (xZoom !== timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX)) {
          handleXZoom(timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX));
        }
      }}
    >
      <Iterations />
    </button>
    <button
      data-testid="zoom-button"
      type="button"
      className={cx('zoom-button', {
        'zoom-button-clicked': zoomMode,
        'zoom-button-disabled': !!waypointsPanelData?.deployedWaypoints?.size,
      })}
      onClick={toggleZoomMode}
      disabled={!!waypointsPanelData?.deployedWaypoints?.size}
    >
      <ZoomIn className="icon" />
    </button>
    <button
      type="button"
      data-testid="menu-button"
      className="menu-button"
      onClick={() => setShowSettingsPanel(true)}
    >
      <Sliders />
    </button>
  </div>
);

export default SpaceTimeChartToolbar;
