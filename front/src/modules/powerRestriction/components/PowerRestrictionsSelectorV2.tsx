import React, { useEffect, useMemo } from 'react';

import { Alert } from '@osrd-project/ui-icons';
import { isEmpty, last, type Dictionary } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { PowerRestrictionRange } from 'applications/operationalStudies/consts';
import icon from 'assets/pictures/components/power_restrictions.svg';
import type { RangedValue, RollingStock } from 'common/api/osrdEditoastApi';
import IntervalsEditor from 'common/IntervalsEditor/IntervalsEditor';
import { INTERVAL_TYPES } from 'common/IntervalsEditor/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import NO_POWER_RESTRICTION from 'modules/powerRestriction/consts';
import displayPowerRestrictionIntervals from 'modules/powerRestriction/helpers/displayPowerRestrictionIntervals';
import {
  countWarnings,
  getPowerRestrictionsWarnings,
} from 'modules/powerRestriction/helpers/powerRestrictionSelector';
import type { PowerRestrictionWarning } from 'modules/powerRestriction/types';
import { useAppDispatch } from 'store';

/** Arbitrairy default segment length (1km) */
const DEFAULT_SEGMENT_LENGTH = 1000;

interface PowerRestrictionsSelectorProps {
  pathElectrificationRanges: RangedValue[];
  rollingStockPowerRestrictions: RollingStock['power_restrictions'];
  rollingStockModes: RollingStock['effort_curves']['modes'];
}

const PowerRestrictionsSelectorV2 = ({
  pathElectrificationRanges,
  rollingStockModes,
  rollingStockPowerRestrictions,
}: PowerRestrictionsSelectorProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const { getPowerRestrictionRanges } = useOsrdConfSelectors();
  const { updatePowerRestrictionRanges } = useOsrdConfActions();
  const powerRestrictionRanges = useSelector(getPowerRestrictionRanges);

  const pathLength = useMemo(() => {
    const lastPathSegment = last(pathElectrificationRanges);
    return lastPathSegment ? lastPathSegment.end : DEFAULT_SEGMENT_LENGTH;
  }, [pathElectrificationRanges]);

  /** Compute the list of points where the electrification changes on path to give them to the intervals editor as operationalPoints */
  const electrificationChangePoints = useMemo(() => {
    const specialPoints = [
      ...pathElectrificationRanges.map((electrificationRange) => ({
        position: electrificationRange.end,
      })),
    ];
    specialPoints.pop();
    return specialPoints;
  }, [pathElectrificationRanges]);

  /** Format the electrification ranges to display them on the interval editor */
  const formattedPathElectrificationRanges = useMemo(
    () =>
      pathElectrificationRanges.map((electrificationRange) => ({
        begin: electrificationRange.begin,
        end: electrificationRange.end,
        value: `${electrificationRange.value}`,
      })),
    [pathElectrificationRanges]
  );

  /** Set up the powerRestrictionRanges with the electrificationChangePoints */
  useEffect(() => {
    if (
      isEmpty(powerRestrictionRanges) ||
      (powerRestrictionRanges.length === 1 &&
        powerRestrictionRanges[0].value === NO_POWER_RESTRICTION)
    ) {
      if (!isEmpty(pathElectrificationRanges)) {
        const initialPowerRestrictionRanges = pathElectrificationRanges.map((pathSegment) => ({
          begin: pathSegment.begin,
          end: pathSegment.end,
          value: NO_POWER_RESTRICTION,
        }));
        dispatch(updatePowerRestrictionRanges(initialPowerRestrictionRanges));
      } else {
        dispatch(
          updatePowerRestrictionRanges([
            {
              begin: 0,
              end: pathLength,
              value: NO_POWER_RESTRICTION,
            },
          ])
        );
      }
    }
  }, [pathElectrificationRanges]);

  /** List of options of the rollingStock's power restrictions + option noPowerRestriction */
  const powerRestrictionOptions = useMemo(
    () => [NO_POWER_RESTRICTION, ...Object.keys(rollingStockPowerRestrictions)],
    [rollingStockPowerRestrictions]
  );

  const editPowerRestrictionRanges = (newPowerRestrictionRanges: IntervalItem[]) => {
    dispatch(updatePowerRestrictionRanges(newPowerRestrictionRanges as PowerRestrictionRange[]));
  };

  /** Check the compatibility between the powerRestrictionRanges and the electrifications */
  const powerRestrictionsWarnings = useMemo(
    () =>
      !isEmpty(rollingStockPowerRestrictions) &&
      !isEmpty(pathElectrificationRanges) &&
      !isEmpty(powerRestrictionRanges)
        ? getPowerRestrictionsWarnings(
            powerRestrictionRanges,
            pathElectrificationRanges,
            rollingStockModes
          )
        : ({} as Dictionary<PowerRestrictionWarning[]>),
    [powerRestrictionRanges]
  );

  const totalPowerRestrictionWarnings = useMemo(
    () => countWarnings(powerRestrictionsWarnings),
    [powerRestrictionsWarnings]
  );

  useEffect(() => {
    const formattedPowerRestrictionRanges = displayPowerRestrictionIntervals(
      formattedPathElectrificationRanges,
      powerRestrictionRanges
    );
    dispatch(updatePowerRestrictionRanges(formattedPowerRestrictionRanges));
  }, [formattedPathElectrificationRanges]);

  return (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container text-muted">
        <img width="32px" className="mr-2" src={icon} alt="PowerRestrictionIcon" />
        <span>{t('powerRestriction')}</span>
        {!isEmpty(rollingStockPowerRestrictions) ? (
          <>
            <p className="mb-1 mt-1">{t('powerRestrictionExplanationText')}</p>
            {totalPowerRestrictionWarnings > 0 && (
              <div className="border border-warning rounded p-3 my-3">
                <div className="d-flex align-items-center mb-2">
                  <div className="d-flex align-items-center text-warning">
                    <Alert />
                  </div>
                  <span className="ml-2">
                    {t('warningMessages.inconsistent', { count: totalPowerRestrictionWarnings })}
                  </span>
                </div>
                {Object.entries(powerRestrictionsWarnings).map(
                  ([warningCategory, warningsByCategory]) => (
                    <div className="d-flex flex-column" key={warningCategory}>
                      {warningsByCategory.map(
                        ({ powerRestrictionCode, electrification, begin, end }) => (
                          <span key={`${powerRestrictionCode}-${begin}-${end}`}>
                            {warningCategory !== NO_POWER_RESTRICTION
                              ? t('warningMessages.powerRestrictionInvalidCombination', {
                                  powerRestrictionCode,
                                  electrification,
                                  begin,
                                  end,
                                })
                              : t('warningMessages.missingPowerRestriction', {
                                  begin,
                                  end,
                                })}
                          </span>
                        )
                      )}
                    </div>
                  )
                )}
              </div>
            )}
            <IntervalsEditor
              additionalData={formattedPathElectrificationRanges}
              intervalType={INTERVAL_TYPES.SELECT}
              data={powerRestrictionRanges}
              defaultValue={NO_POWER_RESTRICTION}
              emptyValue={NO_POWER_RESTRICTION}
              operationalPoints={electrificationChangePoints}
              selectOptions={powerRestrictionOptions}
              setData={editPowerRestrictionRanges}
              totalLength={pathLength}
            />
          </>
        ) : (
          <p className="pt-1">{t('powerRestrictionEmptyExplanationText')}</p>
        )}
      </div>
    </div>
  );
};

export default PowerRestrictionsSelectorV2;
