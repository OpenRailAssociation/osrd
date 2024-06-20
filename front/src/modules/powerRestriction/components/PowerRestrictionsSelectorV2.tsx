import React, { useEffect, useMemo, useState } from 'react';

import { Alert } from '@osrd-project/ui-icons';
import { compact, isEmpty, keyBy, last, type Dictionary } from 'lodash';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import type { PowerRestrictionV2 } from 'applications/operationalStudies/consts';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import icon from 'assets/pictures/components/power_restrictions.svg';
import type { RangedValue, RollingStock, TrackRange } from 'common/api/osrdEditoastApi';
import IntervalsEditor from 'common/IntervalsEditor/IntervalsEditor';
import { INTERVAL_TYPES } from 'common/IntervalsEditor/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import NO_POWER_RESTRICTION from 'modules/powerRestriction/consts';
import type { PowerRestrictionWarning } from 'modules/powerRestriction/types';
// import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { getPointCoordinates } from 'utils/geometry';

import createPathStep from '../helpers/createPathStep';
import formatPowerRestrictions from '../helpers/formatPowerRestrictions';
import { getPowerRestrictionsWarnings, countWarnings } from '../helpers/powerRestrictionSelector';

const DEFAULT_SEGMENT_LENGTH = 1000;

type PowerRestrictionsSelectorProps = {
  pathElectrificationRanges: RangedValue[];
  rollingStockPowerRestrictions: RollingStock['power_restrictions'];
  rollingStockModes: RollingStock['effort_curves']['modes'];
  pathProperties: ManageTrainSchedulePathProperties | undefined;
};

const PowerRestrictionsSelectorV2 = ({
  pathElectrificationRanges,
  rollingStockModes,
  rollingStockPowerRestrictions,
  pathProperties,
}: PowerRestrictionsSelectorProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useAppDispatch();
  const { getPowerRestrictionV2, getPathSteps } = useOsrdConfSelectors();
  const {
    upsertPowerRestrictionRangesV2,
    resetPowerRestrictionRangesV2,
    cutPowerRestrictionRangesV2,
    deletePowerRestrictionRangesV2,
  } = useOsrdConfActions();
  const powerRestrictionRanges = useSelector(getPowerRestrictionV2);
  const pathSteps = compact(useSelector(getPathSteps));

  // pathSteps + points de coupure d'électricité
  // const [updatedPathSteps, setUpdatedPathSteps] = useState<PathStep[]>([]);
  const [cutPositions, setCutPositions] = useState<number[]>([]);
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

  const powerRestrictionOptions = useMemo(
    () => [NO_POWER_RESTRICTION, ...Object.keys(rollingStockPowerRestrictions)],
    [rollingStockPowerRestrictions]
  );

  const findTrackSectionIndex = (position: number) => {
    for (let i = 0; i < cumulativeSums.length; i += 1) {
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

  const editPowerRestrictionRanges = (
    newPowerRestrictionRanges: IntervalItem[],
    selectedIntervalIndex?: number
  ) => {
    if (selectedIntervalIndex === undefined) {
      return;
    }
    const newDispatchedValue = newPowerRestrictionRanges[selectedIntervalIndex];

    let fromPathStep = pathSteps.find((step) => step.positionOnPath === newDispatchedValue.begin);
    if (!fromPathStep) {
      fromPathStep = createPathStep(
        newDispatchedValue.begin,
        cumulativeSums,
        pathProperties,
        pathSteps
      );
    }
    let toPathStep = pathSteps.find((step) => step.positionOnPath === newDispatchedValue.end);
    if (!toPathStep) {
      toPathStep = createPathStep(
        newDispatchedValue.end,
        cumulativeSums,
        pathProperties,
        pathSteps
      );
    }

    if (fromPathStep && toPathStep) {
      if (newDispatchedValue.value !== NO_POWER_RESTRICTION) {
        dispatch(
          upsertPowerRestrictionRangesV2({
            from: fromPathStep,
            to: toPathStep,
            code: newDispatchedValue.value.toString(),
          })
        );
      } else {
        dispatch(deletePowerRestrictionRangesV2({ from: fromPathStep, to: toPathStep }));
      }
    }
  };

  const cutPowerRestrictionRange = (cutAtPosition: number) => {
    const intervalCut = intervalsEditorData.find(
      (interval) => interval.begin <= cutAtPosition && interval.end >= cutAtPosition
    );
    if (!intervalCut || !pathProperties || intervalCut.value === NO_POWER_RESTRICTION) {
      const newCutPositions = !cutPositions.length
        ? [cutAtPosition]
        : cutPositions.flatMap((position, index) => {
            if (position > cutAtPosition) {
              return [cutAtPosition, position];
            }
            if (index === cutPositions.length - 1) {
              return [position, cutAtPosition];
            }
            return [position];
          });
      setCutPositions(newCutPositions);
      return;
    }

    const trackSectionRangeAtCut = findTrackSection(cutAtPosition);

    if (trackSectionRangeAtCut) {
      const offsetAtCut = calculateOffset(trackSectionRangeAtCut, cutAtPosition);
      const coordinatesAtCut = getPointCoordinates(
        pathProperties.geometry,
        pathLength,
        cutAtPosition
      );
      const cutAt = {
        id: nextId(),
        positionOnPath: cutAtPosition,
        coordinates: coordinatesAtCut,
        track: trackSectionRangeAtCut.track_section,
        offset: offsetAtCut,
      };

      dispatch(cutPowerRestrictionRangesV2({ cutAt }));
    }
  };

  const deletePowerRestrictionRange = (from: number, to: number) => {
    const fromPathStep = pathSteps.find((step) => step.positionOnPath === from);
    const toPathStep = pathSteps.find((step) => step.positionOnPath === to);

    if (fromPathStep && toPathStep) {
      dispatch(deletePowerRestrictionRangesV2({ from: fromPathStep, to: toPathStep }));
    }
  };

  const formatElectricalRanges = (
    ranges: PowerRestrictionV2[]
  ): { begin: number; end: number; value: string }[] => {
    const pathStepsById = keyBy(pathSteps, 'id');
    const formattedRanges = compact(
      ranges.map((range) => {
        const begin = pathStepsById[range.from]?.positionOnPath;
        const end = pathStepsById[range.to]?.positionOnPath;

        if (begin !== undefined && end !== undefined) {
          return {
            begin,
            end,
            value: range.code,
          };
        }
        return null;
      })
    );
    return formattedRanges;
  };

  /** Check the compatibility between the powerRestrictionRanges and the electrifications */
  const powerRestrictionsWarnings = useMemo(
    () =>
      !isEmpty(rollingStockPowerRestrictions) &&
      !isEmpty(pathElectrificationRanges) &&
      !isEmpty(powerRestrictionRanges)
        ? getPowerRestrictionsWarnings(
            formatElectricalRanges(powerRestrictionRanges),
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
    if (pathProperties) {
      const newIntervalEditorData = formatPowerRestrictions(
        powerRestrictionRanges,
        [...electrificationChangePoints.map(({ position }) => position), ...cutPositions],
        compact(pathSteps),
        pathProperties?.length
      );
      setIntervalsEditorData(newIntervalEditorData);
    }
  }, [electrificationChangePoints, cutPositions, powerRestrictionRanges]);

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
              additionalData={pathElectrificationRanges}
              intervalType={INTERVAL_TYPES.SELECT}
              data={intervalsEditorData}
              defaultValue={NO_POWER_RESTRICTION}
              emptyValue={NO_POWER_RESTRICTION}
              operationalPoints={electrificationChangePoints}
              selectOptions={powerRestrictionOptions}
              setData={editPowerRestrictionRanges}
              onCut={cutPowerRestrictionRange}
              onDelete={deletePowerRestrictionRange}
              totalLength={pathLength}
              toolsConfig={{
                cutTool: true,
                deleteTool: true,
              }}
              disableDrag
            />
            <button type="button" onClick={() => dispatch(resetPowerRestrictionRangesV2())}>
              RESET
            </button>
          </>
        ) : (
          <p className="pt-1">{t('powerRestrictionEmptyExplanationText')}</p>
        )}
      </div>
    </div>
  );
};

export default PowerRestrictionsSelectorV2;
