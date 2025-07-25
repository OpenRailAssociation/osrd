import React from 'react';

import { Iterations, Dash, Plus, KebabHorizontal } from '@osrd-project/ui-icons';
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
    <div className="zoom-buttons">
      <button
        className={cx('interaction-button reset-button', {
          inactive: store.ratioX == 1 && store.leftOffset == 0,
        })}
        onClick={() => reset()}
        data-testid={testIdPrefix ? `${testIdPrefix}-reset` : undefined}
      >
        <Iterations />
      </button>
      <button
        className="interaction-button plus-button inactive"
        data-testid={testIdPrefix ? `${testIdPrefix}-zoom-in` : undefined}
      >
        <Plus />
      </button>
      <button
        className="interaction-button inactive"
        data-testid={testIdPrefix ? `${testIdPrefix}-zoom-out` : undefined}
      >
        <Dash />
      </button>
    </div>
    <button
      className="interaction-button elipsis-button"
      data-testid={testIdPrefix ? `${testIdPrefix}-settings` : undefined}
      onClick={() => openSettingsPanel()}
    >
      <KebabHorizontal />
    </button>
  </div>
);

export default InteractionButtons;
