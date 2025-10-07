import React from 'react';

import cx from 'classnames';

import type { Store } from '../../types';
import { MARGINS } from '../const';

const DETAILBOX_MARGIN = 6;
const DETAILBOX_OFFSET = 12;
const DETAILBOX_LIMIT = 10;

type DetailsBoxProps = {
  width: number;
  height: number;
  store: Store;
  curveX: number;
  curveY: number;
  speedText: string;
  ecoSpeedText: string;
  effortText: string;
  electricalModeText: string;
  electricalProfileText: string;
  powerRestrictionText: string;
  previousGradientText: number;
  modeText: string;
};

// TODO: add ETCS details
const DetailsBox = ({
  width,
  height,
  store,
  curveX,
  curveY,
  speedText,
  ecoSpeedText,
  effortText,
  electricalModeText,
  electricalProfileText,
  powerRestrictionText,
  previousGradientText,
  modeText,
}: DetailsBoxProps) => {
  const { MARGIN_BOTTOM, MARGIN_RIGHT } = MARGINS;
  const { energySource, tractionStatus, declivities, electricalProfiles, powerRestrictions } =
    store.detailsBoxDisplay;

  let rightOffset = 0;
  let bottomOffset = 0;

  const detailsBoxWidth = document.getElementById('details-box')?.offsetWidth || 0;
  const detailsBoxHeight = document.getElementById('details-box')?.offsetHeight || 0;

  // find out if the box is going out off the right side of the canvas
  if (curveX + detailsBoxWidth > width - MARGIN_RIGHT - DETAILBOX_LIMIT)
    rightOffset = detailsBoxWidth + DETAILBOX_OFFSET;
  // find out if the box is going out off the bottom side of the canvas
  if (curveY + detailsBoxHeight > height - MARGIN_BOTTOM - DETAILBOX_LIMIT)
    bottomOffset = detailsBoxHeight + DETAILBOX_OFFSET;

  const boxX = curveX + DETAILBOX_MARGIN - rightOffset;
  const boxY = curveY + DETAILBOX_MARGIN - bottomOffset;

  const speedDifference = Number(speedText) - Number(ecoSpeedText);
  const speedDifferenceText = speedDifference !== 0 ? `-${speedDifference.toFixed(1)}` : null;

  return (
    <div
      id="details-box"
      className={cx('absolute flex flex-col', { block: curveY, hidden: !curveY })}
      style={{
        marginTop: boxY,
        marginLeft: boxX,
      }}
    >
      <span id="base-speed-text">{speedText || '--'}</span>
      <div>
        <span id="mareco-speed-text">{ecoSpeedText || '--'}</span>
        {speedDifferenceText && <span id="speed-difference-text">{speedDifferenceText}</span>}
      </div>
      {(energySource || tractionStatus || modeText || effortText) && <hr />}
      {energySource && <span id="mode-text">{modeText || '--'}</span>}
      {tractionStatus && <span id="effort-text">{effortText || '--'}</span>}
      {electricalModeText && (
        <div id="electrical-mode-text">
          <span>{electricalModeText || '--'}</span>
          {electricalProfiles && <span className="ml-2">{electricalProfileText || '--'}</span>}
        </div>
      )}
      {powerRestrictions && <span id="power-restriction-text">{powerRestrictionText || '--'}</span>}
      {declivities && (
        <>
          <hr />
          <span id="previous-gradient-text">{`${previousGradientText} ‰`}</span>
        </>
      )}
    </div>
  );
};

export default DetailsBox;
