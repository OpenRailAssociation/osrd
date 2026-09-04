import React from 'react';

import cx from 'classnames';

import type { EtcsBrakingCurveType, EtcsBrakingType, EtcsSpeedValue, Store } from '../../types';
import { ETCS_COLOR_DICTIONARY, MARGINS } from '../const';
import type { SpeedSpaceChartProps } from '../SpeedSpaceChart';
import { getActiveEtcsBrakingCurveTypes, getActiveEtcsBrakingTypes } from '../utils';

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
  etcsSpeedValues?: Record<EtcsBrakingType, Record<EtcsBrakingCurveType, EtcsSpeedValue[]>>;
  translations?: SpeedSpaceChartProps['translations'];
  effortText: string;
  electricalModeText: string;
  electricalProfileText: string;
  powerRestrictionText: string;
  previousGradientText: number;
  modeText: string;
};

const DetailsBox = ({
  width,
  height,
  store,
  curveX,
  curveY,
  speedText,
  ecoSpeedText,
  etcsSpeedValues,
  translations,
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

  const reticleValues = translations?.detailsBoxDisplay.reticleValues;
  const translatedModeText =
    modeText === '--'
      ? modeText
      : (reticleValues?.[modeText as keyof typeof reticleValues] ?? modeText);
  const translatedEffortText =
    reticleValues?.[effortText as keyof typeof reticleValues] ?? effortText;
  const translatedElectricalProfileText =
    electricalProfileText === 'incompatible'
      ? (reticleValues?.incompatible ?? electricalProfileText)
      : electricalProfileText;

  const activeEtcsBrakingTypes = getActiveEtcsBrakingTypes(store.etcsLayersDisplay);
  const activeEtcsBrakingCurveTypes = getActiveEtcsBrakingCurveTypes(store.etcsLayersDisplay);
  const etcsEndOfCurves = etcsSpeedValues
    ? [
        ...new Set(
          activeEtcsBrakingTypes.flatMap((etcsBrakingType) =>
            activeEtcsBrakingCurveTypes.flatMap((etcsBrakingCurveType) =>
              etcsSpeedValues[etcsBrakingType][etcsBrakingCurveType].map(
                (etcsValue) => etcsValue.etcsEndOfCurvePos
              )
            )
          )
        ),
      ]
        .sort((a, b) => a - b)
        .map((n) => n.toFixed(1))
    : [];
  return (
    <div
      id="details-box"
      className={cx('absolute flex flex-row', { block: curveY, hidden: !curveY })}
      style={{
        marginTop: boxY,
        marginLeft: boxX,
      }}
    >
      <div className="default-details-box">
        <span id="base-speed-text">{speedText || '--'}</span>
        <div>
          <span id="mareco-speed-text">{ecoSpeedText || '--'}</span>
          {speedDifferenceText && <span id="speed-difference-text">{speedDifferenceText}</span>}
        </div>
        {(energySource || tractionStatus || modeText || effortText) && <hr />}
        {energySource && <span id="mode-text">{translatedModeText || '--'}</span>}
        {tractionStatus && <span id="effort-text">{translatedEffortText || '--'}</span>}
        {electricalModeText && (
          <div id="electrical-mode-text">
            <span>{electricalModeText || '--'}</span>
            {electricalProfiles && (
              <span className="ml-2">{translatedElectricalProfileText || '--'}</span>
            )}
          </div>
        )}
        {powerRestrictions && (
          <span id="power-restriction-text">{powerRestrictionText || '--'}</span>
        )}
        {declivities && (
          <>
            <hr />
            <span id="previous-gradient-text">{`${previousGradientText} ‰`}</span>
          </>
        )}
      </div>
      {store.detailsBoxDisplay.etcs &&
        etcsSpeedValues &&
        activeEtcsBrakingTypes.length > 0 &&
        activeEtcsBrakingCurveTypes.length > 0 && (
          <div className="etcs-details-box" style={{ minHeight: detailsBoxHeight }}>
            <div
              className="etcs-grid"
              style={{ gridTemplateColumns: `repeat(${etcsEndOfCurves.length + 2}, auto)` }}
            >
              <div className="etcs-row-group" style={{ gridColumnStart: 3 }}>
                {etcsEndOfCurves.map((endOfCurve) => (
                  <div key={endOfCurve} className="number-text">
                    {endOfCurve}
                  </div>
                ))}
              </div>
              {activeEtcsBrakingTypes.map((brakingType) => {
                const specificEtcsSpeeds = etcsSpeedValues[brakingType];
                return (
                  <div key={brakingType} className="etcs-row-group">
                    {activeEtcsBrakingCurveTypes.map((brakingCurveType, index) => {
                      const speedValues = specificEtcsSpeeds[brakingCurveType];
                      return (
                        <>
                          {index === 0 && (
                            <div
                              style={{
                                gridRow: `span ${activeEtcsBrakingCurveTypes.length}`,
                              }}
                            >
                              {translations?.etcsLayersDisplay.etcsBrakingTypes[brakingType] ||
                                brakingType}
                            </div>
                          )}
                          <div
                            style={{
                              color: ETCS_COLOR_DICTIONARY[brakingCurveType].toString(),
                            }}
                          >
                            {brakingCurveType}
                          </div>
                          {etcsEndOfCurves.map((endOfCurve) => (
                            <div
                              key={endOfCurve}
                              className="number-text"
                              style={{
                                color: ETCS_COLOR_DICTIONARY[brakingCurveType].toString(),
                              }}
                            >
                              {speedValues
                                .find(
                                  (speedValue) =>
                                    speedValue.etcsEndOfCurvePos.toFixed(1) === endOfCurve
                                )
                                ?.etcsSpeed.toFixed(2) ?? '--'}
                            </div>
                          ))}
                        </>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
};

export default DetailsBox;
