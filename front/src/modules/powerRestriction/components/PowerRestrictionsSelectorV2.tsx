import React, { useEffect, useMemo, useState } from 'react';

import { compact, isEmpty, keyBy, last, type Dictionary } from 'lodash';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import icon from 'assets/pictures/components/power_restrictions.svg';
import type { RangedValue, RollingStock, TrackRange } from 'common/api/osrdEditoastApi';
import IntervalsEditor from 'common/IntervalsEditor/IntervalsEditor';
import { INTERVAL_TYPES } from 'common/IntervalsEditor/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import NO_POWER_RESTRICTION from 'modules/powerRestriction/consts';
import type { PowerRestrictionWarning } from 'modules/powerRestriction/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { getPointCoordinates } from 'utils/geometry';
import { Alert } from '@osrd-project/ui-icons';
import { getPowerRestrictionsWarnings, countWarnings } from '../helpers/powerRestrictionSelector';
import type { PowerRestrictionV2 } from 'applications/operationalStudies/consts';

const DEFAULT_SEGMENT_LENGTH = 1000;

interface PowerRestrictionsSelectorProps {
  pathElectrificationRanges: RangedValue[];
  rollingStockPowerRestrictions: RollingStock['power_restrictions'];
  rollingStockModes: RollingStock['effort_curves']['modes'];
  pathProperties: ManageTrainSchedulePathProperties | undefined;
}

const PowerRestrictionsSelectorV2 = ({
  pathElectrificationRanges,
  rollingStockModes,
  rollingStockPowerRestrictions,
  pathProperties,
}: PowerRestrictionsSelectorProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const { getPowerRestrictionV2, getPathSteps } = useOsrdConfSelectors();
  const { updatePowerRestrictionRangesV2, resetPowerRestrictionRangesV2 } = useOsrdConfActions();
  const powerRestrictionRanges = useSelector(getPowerRestrictionV2);
  const pathSteps = useSelector(getPathSteps);
  console.log('pathSteps', pathSteps);

  const formatElectricalRanges = (ranges: PowerRestrictionV2[]) => {
    const pathStepsById = keyBy(pathSteps, 'id');
    const formattedRanges = ranges.map((range) => ({
      begin: pathStepsById[range.from]?.positionOnPath!!,
      end: pathStepsById[range.to]?.positionOnPath!!,
      value: range.code,
    }));
    return formattedRanges;
  };

  const [updatedPathSteps, setUpdatedPathSteps] = useState<PathStep[]>([]);
  const [intervalsEditorData, setIntervalsEditorData] = useState<IntervalItem[]>([]);

  const pathLength = useMemo(() => {
    const lastPathSegment = last(pathElectrificationRanges);
    return lastPathSegment ? lastPathSegment.end : DEFAULT_SEGMENT_LENGTH;
  }, [pathElectrificationRanges]);

  const electrificationChangePoints = useMemo(() => {
    const specialPoints = pathElectrificationRanges.map((range) => ({
      position: range.end,
    }));
    specialPoints.pop();
    return specialPoints;
  }, [pathElectrificationRanges]);

  const [formattedPathElectrificationRanges, setFormattedPathElectrificationRanges] =
    useState(pathElectrificationRanges);

  /** Check the compatibility between the powerRestrictionRanges and the electrifications */
  // const powerRestrictionsWarnings = useMemo(
  //   () =>
  //     !isEmpty(rollingStockPowerRestrictions) &&
  //     !isEmpty(pathElectrificationRanges) &&
  //     !isEmpty(powerRestrictionRanges)
  //       ? getPowerRestrictionsWarnings(
  //           formatElectricalRanges(powerRestrictionRanges),
  //           pathElectrificationRanges,
  //           rollingStockModes
  //         )
  //       : ({} as Dictionary<PowerRestrictionWarning[]>),
  //   [powerRestrictionRanges]
  // );

  // const totalPowerRestrictionWarnings = useMemo(
  //   () => countWarnings(powerRestrictionsWarnings),
  //   [powerRestrictionsWarnings]
  // );

  useEffect(() => {
    console.log({ pathProperties });
  }, []);

  const cumulativeSums = useMemo(
    () =>
      pathProperties?.trackSectionRanges.reduce<number[]>((acc, section) => {
        const lastSum = acc.length > 0 ? acc[acc.length - 1] : 0;
        const adjustedEnd = section.end - (section.begin > 0 ? section.begin : 0);
        acc.push(lastSum + adjustedEnd);
        return acc;
      }, []) || [],
    [pathProperties]
  );

  const findTrackSectionIndex = (position: number) => {
    for (let i = 0; i < cumulativeSums.length; i++) {
      if (position <= cumulativeSums[i]) {
        return i;
      }
    }
    return -1;
  };

  const findTrackSection = (position: number) => {
    const index = findTrackSectionIndex(position);
    return index !== -1 ? pathProperties?.trackSectionRanges[index] : null;
  };

  const calculateOffset = (trackSectionRange: TrackRange, position: number) => {
    const index = findTrackSectionIndex(position);
    const inferiorSum = cumulativeSums[index];
    return trackSectionRange.direction === 'START_TO_STOP'
      ? inferiorSum - position
      : position - inferiorSum;
  };

  const powerRestrictionOptions = useMemo(
    () => [NO_POWER_RESTRICTION, ...Object.keys(rollingStockPowerRestrictions)],
    [rollingStockPowerRestrictions]
  );

  const editPowerRestrictionRanges = (
    newPowerRestrictionRanges: IntervalItem[],
    selectedIntervalIndex?: number
  ) => {
    const newDispatchedValue = selectedIntervalIndex
      ? newPowerRestrictionRanges[selectedIntervalIndex]
      : undefined;

    console.log('New Power Restriction Ranges:', {
      newPowerRestrictionRanges,
      intervalsEditorData,
      newDispatchedValue,
      selectedIntervalIndex,
    });

    console.log(updatedPathSteps, 'updatedPathSteps');

    if (!newDispatchedValue) {
      setIntervalsEditorData(newPowerRestrictionRanges);
      return;
    }
    const fromPoint = updatedPathSteps.find(
      (step) => step.positionOnPath === newDispatchedValue?.begin
    );
    const toPoint = updatedPathSteps.find(
      (step) => step.positionOnPath === newDispatchedValue?.end
    );

    console.log('fromPoint', fromPoint, 'toPoint', toPoint);
    if (fromPoint && toPoint) {
      dispatch(
        updatePowerRestrictionRangesV2({
          from: fromPoint,
          to: toPoint,
          code: newDispatchedValue.value.toString(),
        })
      );
    }
  };

  useEffect(() => {
    const pathStepById = keyBy(pathSteps, 'id');
    const intervalsMap = new Map();
    console.log('Données debut du useEffect intervalsEditorData', {
      intervalsEditorData,
      powerRestrictionRanges,
      pathStepById,
      pathSteps,
    });

    powerRestrictionRanges.forEach((range) => {
      const from = pathStepById[range.from];
      const to = pathStepById[range.to];

      console.log('forEach PowRestRanges', { range, from, to });
      if (from && to) {
        const testBegin = intervalsEditorData.find((item) => item.begin === from.positionOnPath);
        const testEnd = intervalsEditorData.find((item) => item.end === to.positionOnPath);
        console.log({ testBegin, testEnd }, 'testBegin testEnd');
        if (testBegin && !testEnd) {
          console.log('begin mais pas end ', {
            begin: testBegin.begin,
            end: from.positionOnPath,
            value: testBegin.value,
          });
          intervalsMap.set(from.positionOnPath, {
            begin: testBegin.begin,
            end: from.positionOnPath,
            value: testBegin.value,
          });
        }
        if (!testBegin && testEnd) {
          console.log('end mais pas begin ', {
            begin: to.positionOnPath,
            end: testEnd.end,
            value: testEnd.value,
          });
          intervalsMap.set(from.positionOnPath, {
            begin: to.positionOnPath,
            end: testEnd.end,
            value: testEnd.value,
          });
        }
        intervalsMap.set(from.positionOnPath, {
          begin: from.positionOnPath,
          end: to.positionOnPath,
          value: range.code,
        });
      }
      console.log(intervalsMap, 'intervalsMap AORPOARE?FOPA');
    });
    console.log('Données mid useEffect -> ', { intervalsMap, powerRestrictionRanges });

    pathElectrificationRanges.forEach((range) => {
      let current = range.begin;
      while (current < range.end) {
        console.log(current, 'current while');
        const nextChangePoint = electrificationChangePoints.find(
          (point) => point.position > current && point.position <= range.end
        );

        const nextPosition = nextChangePoint ? nextChangePoint.position : range.end;
        if (!intervalsMap.has(current)) {
          intervalsMap.set(current, {
            begin: current,
            end: nextPosition,
            value: NO_POWER_RESTRICTION,
          });
        }

        current = nextPosition;
        console.log({ nextChangePoint, range, current, nextPosition }, 'nextChangePoint');
      }
    });

    console.log('Données fin du useEffect', {
      intervalsEditorData: Array.from(intervalsMap.values()).sort((a, b) => a.begin - b.begin),
      intervalsMap,
      pathElectrificationRanges,
    });
    setIntervalsEditorData(Array.from(intervalsMap.values()).sort((a, b) => a.begin - b.begin));
  }, [electrificationChangePoints, pathSteps]);

  useEffect(() => {
    const existingPositions = new Set(pathSteps.map((step) => step?.positionOnPath));
    const newSteps = intervalsEditorData.map((range) => {
      const trackSectionRange = findTrackSection(range.begin);
      const isStepDuplicate = existingPositions.has(range.begin);
      if (range.begin === 0 || !pathProperties || !trackSectionRange || isStepDuplicate)
        return null;

      const offset = calculateOffset(trackSectionRange, range.begin);
      const coordinates = getPointCoordinates(pathProperties.geometry, pathLength, range.begin);
      return {
        id: nextId(),
        positionOnPath: range.begin,
        coordinates,
        track: trackSectionRange.track_section,
        offset,
      };
    });

    const combinedSteps = compact([...pathSteps, ...(newSteps as PathStep[])]);
    setUpdatedPathSteps(combinedSteps.sort((a, b) => a.positionOnPath!! - b.positionOnPath!!));
    console.log(intervalsEditorData, 'intervalsEditor Data avant reduce');
    console.log(pathElectrificationRanges, 'pathElectrificationRanges avant reduce');

    const filledElectricRanges = pathElectrificationRanges.reduce(
      (acc, curr, index) => {
        // curr = 217 -> 417 || 417 !== 608 (curr +1) || newInterval => begin = ( curr existe dans intervalRanges ? curr.end : curr.begin), end = next.begin, value = curr.value
        const next =
          index < pathElectrificationRanges.length - 1
            ? pathElectrificationRanges[index + 1]
            : null;
        const isIntervalRange = acc.find(
          (item) => item.begin === curr.begin && item.end === curr.end
        );
        console.log({ next, isIntervalRange, curr }, 'next, isIntervalRange, curr');
        if ((isIntervalRange && !next) || curr.end === next?.begin) return acc; // si dernier range est un interval et qu'il n'y a pas de next, on ne fait rien
        const newRange = {
          begin: isIntervalRange ? curr.end : curr.begin,
          end: next ? next.begin : curr.end,
          value: 'NO_POWER_RESTRICTION',
        };
        console.log(newRange, 'new range');
        acc.push(newRange);
        return acc;
      },

      [...intervalsEditorData.values()]
    );
    console.log('filledElectricRanges', filledElectricRanges);
  }, [pathSteps, pathProperties, cumulativeSums, pathLength, intervalsEditorData]);

  const compareArrays = (array1: IntervalItem[], array2: IntervalItem[]) => {
    const differences: { index: number; array1End: number; array2End: number }[] = [];
    array1.forEach((item, index) => {
      if (item.end !== array2[index]?.end) {
        differences.push({
          index,
          array1End: item.end,
          array2End: array2[index]?.end,
        });
      }
    });
    return differences;
  };

  useEffect(() => {
    console.log(formattedPathElectrificationRanges, 'formattedPathElectrificationRanges');
  }, [formattedPathElectrificationRanges]);

  // useEffect(() => {
  //   const differences = compareArrays(intervalsEditorData, formattedPathElectrificationRanges);
  //   console.log(
  //     { differences, intervalsEditorData, formattedPathElectrificationRanges },
  //     'differences'
  //   );

  //   if (differences.length > 0) {
  //     const firstDifference = differences[0];
  //     const updatedRanges = [...formattedPathElectrificationRanges];

  //     updatedRanges[firstDifference.index].end = firstDifference.array1End;

  //     const newElement = {
  //       begin: firstDifference.array1End,
  //       end: firstDifference.array2End,
  //       value: updatedRanges[firstDifference.index].value,
  //     };

  //     updatedRanges.splice(firstDifference.index + 1, 0, newElement);

  //     // Remove the original range that was cut
  //     if (newElement.begin === updatedRanges[firstDifference.index].begin) {
  //       updatedRanges.splice(firstDifference.index, 1);
  //     }
  //     console.log(updatedRanges, 'updatedRanges');
  //     setFormattedPathElectrificationRanges(updatedRanges);
  //     console.log(formattedPathElectrificationRanges, 'formattedPathElectrificationRanges');
  //   }
  // }, [intervalsEditorData]);

  return (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container text-muted">
        <img width="32px" className="mr-2" src={icon} alt="PowerRestrictionIcon" />
        <span>{t('powerRestriction')}</span>
        {!isEmpty(rollingStockPowerRestrictions) ? (
          <>
            <p className="mb-1 mt-1">{t('powerRestrictionExplanationText')}</p>
            {/* {totalPowerRestrictionWarnings > 0 && (
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
            )} */}
            <IntervalsEditor
              additionalData={formattedPathElectrificationRanges}
              intervalType={INTERVAL_TYPES.SELECT}
              data={intervalsEditorData}
              defaultValue={NO_POWER_RESTRICTION}
              emptyValue={NO_POWER_RESTRICTION}
              operationalPoints={electrificationChangePoints}
              selectOptions={powerRestrictionOptions}
              setData={editPowerRestrictionRanges}
              totalLength={pathLength}
            />
            <button onClick={() => dispatch(resetPowerRestrictionRangesV2())}>RESET</button>
          </>
        ) : (
          <p className="pt-1">{t('powerRestrictionEmptyExplanationText')}</p>
        )}
      </div>
    </div>
  );
};

export default PowerRestrictionsSelectorV2;
