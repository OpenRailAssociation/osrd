import React from 'react';

import { Iterations, Dash, Plus, KebabHorizontal } from '@osrd-project/ui-icons';
import cx from 'classnames';

import type { Store } from '../../types';

type InteractionButtonsProps = {
  reset: () => void;
  openSettingsPanel: () => void;
  store: Store;
};

const InteractionButtons = ({ reset, openSettingsPanel, store }: InteractionButtonsProps) => (
  <div id="interaction-button-container" className="z-10">
    <div className="zoom-buttons">
      <button
        className={cx('interaction-button reset-button', {
          inactive: store.ratioX == 1 && store.leftOffset == 0,
        })}
        onClick={() => reset()}
      >
        <Iterations />
      </button>
      <button className="interaction-button plus-button inactive">
        <Plus />
      </button>
      <button className="interaction-button inactive">
        <Dash />
      </button>
    </div>
    <button className="interaction-button elipsis-button" onClick={() => openSettingsPanel()}>
      <KebabHorizontal />
    </button>
  </div>
);

export default InteractionButtons;
