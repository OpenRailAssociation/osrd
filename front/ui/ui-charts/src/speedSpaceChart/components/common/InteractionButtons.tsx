import React from 'react';

import { Iterations, Sliders } from '@osrd-project/ui-icons';
import cx from 'classnames';

import type { Store } from '../../types';

type InteractionButtonsProps = {
  reset: () => void;
  openSettingsPanel: () => void;
  store: Store;
  testIdPrefix?: string;
};

const InteractionButtons = ({
  reset,
  openSettingsPanel,
  store,
  testIdPrefix,
}: InteractionButtonsProps) => (
  <div id="interaction-button-container" className="z-10">
    <button
      type="button"
      className={cx('reset-button', {
        'reset-button-disabled': store.ratioX === 1 && store.leftOffset === 0,
      })}
      onClick={reset}
      data-testid={testIdPrefix ? `${testIdPrefix}-reset` : undefined}
    >
      <Iterations />
    </button>
    <button
      type="button"
      className="menu-button"
      data-testid={testIdPrefix ? `${testIdPrefix}-settings` : undefined}
      onClick={openSettingsPanel}
    >
      <Sliders />
    </button>
  </div>
);
export default InteractionButtons;
