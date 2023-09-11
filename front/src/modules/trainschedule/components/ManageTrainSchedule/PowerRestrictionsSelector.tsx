import { compact, isEmpty, last, reduce, uniq } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import icon from 'assets/pictures/components/power_restrictions.svg';
import { PowerRestrictionRange } from 'applications/operationalStudies/consts';
import { CatenaryRange, RollingStock } from 'common/api/osrdEditoastApi';
import { INTERVAL_TYPES, IntervalItem } from 'common/IntervalsEditor/types';
import IntervalsEditor from 'common/IntervalsEditor/IntervalsEditor';
import { updatePowerRestrictionRanges } from 'reducers/osrdconf';
import { setWarning } from 'reducers/main';
import { getPowerRestrictionRanges } from 'reducers/osrdconf/selectors';

export const NO_POWER_RESTRICTION = 'NO_POWER_RESTRICTION';
/** Arbitrairy default segment length (1km) */
const DEFAULT_SEGMENT_LENGTH = 1000;

interface PowerRestrictionsSelectorProps {
  pathCatenaryRanges: CatenaryRange[];
  rollingStockPowerRestrictions: RollingStock['power_restrictions'];
  rollingStockModes: RollingStock['effort_curves']['modes'];
}

/**
 * Return the power restriction codes of the rolling stock by mode
 *
 * ex: { "1500": ["C1US", "C2US"], "2500": ["M1US"], "thermal": []}
 */
const getRollingStockPowerRestrictionsByMode = (
  rollingStockModes: RollingStock['effort_curves']['modes']
): { [mode: string]: string[] } => {
  const curvesModesKey = Object.keys(rollingStockModes);

  return reduce(
    curvesModesKey,
    (result, mode) => {
      const powerCodes = rollingStockModes[mode].curves.map(
        (curve) => curve.cond?.power_restriction_code
      );
      compact(uniq(powerCodes));
      return {
        ...result,
        [mode]: powerCodes,
      };
    },
    {}
  );
};

const PowerRestrictionsSelector = ({
  pathCatenaryRanges,
  rollingStockModes,
  rollingStockPowerRestrictions,
}: PowerRestrictionsSelectorProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useDispatch();
  const powerRestrictionRanges = useSelector(getPowerRestrictionRanges);

  const pathLength = useMemo(() => {
    const lastPathSegment = last(pathCatenaryRanges);
    return lastPathSegment ? lastPathSegment.end : DEFAULT_SEGMENT_LENGTH;
  }, [pathCatenaryRanges]);

  /** Compute the list of points where the electrification changes on path to give them to the intervals editor as operationalPoints */
  const electrificationChangePoints = useMemo(() => {
    const specialPoints = [
      ...pathCatenaryRanges.map((catenaryRange) => ({
        position: catenaryRange.end,
      })),
    ];
    specialPoints.pop();
    return specialPoints;
  }, [pathCatenaryRanges]);

  /** Format the catenary ranges to display them on the interval editor */
  const formattedPathCatenaryRanges = useMemo(
    () =>
      pathCatenaryRanges.map((catenaryRange) => ({
        begin: catenaryRange.begin,
        end: catenaryRange.end,
        value: `${catenaryRange.mode}V`,
      })),
    [pathCatenaryRanges]
  );

  const powerRestrictionsByMode = useMemo(
    () => getRollingStockPowerRestrictionsByMode(rollingStockModes),
    [rollingStockModes]
  );

  /** Set up the powerRestrictionRanges with the electrificationChangePoints */
  useEffect(() => {
    if (
      isEmpty(powerRestrictionRanges) ||
      (powerRestrictionRanges.length === 1 &&
        powerRestrictionRanges[0].value === NO_POWER_RESTRICTION)
    ) {
      if (!isEmpty(pathCatenaryRanges)) {
        const initialPowerRestrictionRanges = pathCatenaryRanges.map((pathSegment) => ({
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
  }, [pathCatenaryRanges]);

  /** List of options of the rollingStock's power restrictions + option noPowerRestriction */
  const powerRestrictionOptions = useMemo(
    () => [NO_POWER_RESTRICTION, ...Object.keys(rollingStockPowerRestrictions)],
    [rollingStockPowerRestrictions]
  );

  const editPowerRestrictionRanges = (newPowerRestrictionRanges: IntervalItem[]) => {
    dispatch(updatePowerRestrictionRanges(newPowerRestrictionRanges as PowerRestrictionRange[]));
  };

  /** Check the compatibility between the powerRestrictionRanges and the catenaries */
  useEffect(() => {
    if (!isEmpty(pathCatenaryRanges) && !isEmpty(powerRestrictionRanges)) {
      powerRestrictionRanges.forEach((powerRestrictionRange) => {
        // find path ranges crossed or included in the power restriction range
        pathCatenaryRanges.forEach((pathCatenaryRange) => {
          // no intersection between the path range and the power restriction range
          if (
            pathCatenaryRange.end <= powerRestrictionRange.begin ||
            powerRestrictionRange.end <= pathCatenaryRange.begin
          )
            return;
          // check restriction is compatible with the path range's electrification mode
          const isInvalid = !powerRestrictionsByMode[pathCatenaryRange.mode].includes(
            powerRestrictionRange.value
          );
          if (isInvalid) {
            const invalidZoneBegin = Math.round(
              pathCatenaryRange.begin < powerRestrictionRange.begin
                ? powerRestrictionRange.begin
                : pathCatenaryRange.begin
            );
            const invalidZoneEnd = Math.round(
              powerRestrictionRange.end < pathCatenaryRange.end
                ? powerRestrictionRange.end
                : pathCatenaryRange.end
            );
            dispatch(
              setWarning({
                title: t('warningMessages.electrification'),
                text:
                  powerRestrictionRange.value === NO_POWER_RESTRICTION
                    ? t('warningMessages.missingPowerRestriction', {
                        begin: invalidZoneBegin,
                        end: invalidZoneEnd,
                      })
                    : t('warningMessages.powerRestrictionInvalidCombination', {
                        powerRestrictionCode: powerRestrictionRange.value,
                        electrification: pathCatenaryRange.mode,
                        begin: invalidZoneBegin,
                        end: invalidZoneEnd,
                      }),
              })
            );
          }
        });
      });
    }
  }, [powerRestrictionRanges]);

  return (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container text-muted">
        <img width="32px" className="mr-2" src={icon} alt="PowerRestrictionIcon" />
        <span>{t('powerRestriction')}</span>
        <p className="mb-1 mt-1">{t('powerRestrictionExplanationText')}</p>
        <IntervalsEditor
          additionalData={formattedPathCatenaryRanges}
          intervalType={INTERVAL_TYPES.SELECT}
          data={powerRestrictionRanges}
          defaultValue={NO_POWER_RESTRICTION}
          emptyValue={NO_POWER_RESTRICTION}
          operationalPoints={electrificationChangePoints}
          selectOptions={powerRestrictionOptions}
          setData={editPowerRestrictionRanges}
          totalLength={pathLength}
        />
      </div>
    </div>
  );
};

export default PowerRestrictionsSelector;
