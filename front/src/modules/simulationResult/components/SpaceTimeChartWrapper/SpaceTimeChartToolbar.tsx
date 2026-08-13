import type { Dispatch, SetStateAction } from 'react';

import { Iterations, Linking, Sliders, ZoomIn } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useSelector } from 'react-redux';

import { getFeatureFlag } from 'reducers/user/userSelectors';

type SpaceTimeChartToolbarProps = {
  onResetClick: () => void;
  zoomMode: boolean;
  disableZoom: boolean;
  toggleZoomMode: () => void;
  setShowSettingsPanel: Dispatch<SetStateAction<boolean>>;
  className?: string;
  isResetButtonDisabled?: boolean;
};

const SpaceTimeChartToolbar = ({
  onResetClick,
  zoomMode,
  disableZoom,
  toggleZoomMode,
  setShowSettingsPanel,
  isResetButtonDisabled,
}: SpaceTimeChartToolbarProps) => {
  const linkingsActivated = useSelector(getFeatureFlag('linkings'));

  return (
    <div className="toolbar">
      {linkingsActivated && (
        <button
          data-testid="linking-mode-button"
          type="button"
          className="linking-button linking-button-disabled"
          disabled
        >
          {/* TODO: wire the linking mode toggle behavior */}
          <Linking />
        </button>
      )}
      <button
        data-testid="zoom-reset-button"
        type="button"
        className={cx('reset-button', {
          'reset-button-disabled': isResetButtonDisabled,
        })}
        onClick={onResetClick}
        disabled={isResetButtonDisabled}
      >
        <Iterations />
      </button>
      <button
        data-testid="zoom-button"
        type="button"
        className={cx('zoom-button', {
          'zoom-button-clicked': zoomMode,
          'zoom-button-disabled': disableZoom,
        })}
        onClick={toggleZoomMode}
        disabled={disableZoom}
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
};

export default SpaceTimeChartToolbar;
