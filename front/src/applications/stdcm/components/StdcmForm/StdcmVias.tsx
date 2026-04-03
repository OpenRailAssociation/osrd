import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Container, Location } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import filterMissingFields from 'applications/stdcm/utils/filterMissingFields';
import getInvalidFields from 'applications/stdcm/utils/getInvalidFields';
import { updateStdcmPathStep, deleteStdcmVia, addStdcmVia } from 'reducers/osrdconf/stdcmConf';
import { getStdcmPathSteps } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StdcmViaPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';

import StdcmCard from './StdcmCard';
import StdcmConsist from './StdcmConsist';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmStopType from './StdcmStopType';
import StopDurationInput from './StopDurationInput';
import { StdcmStopTypes } from '../../types';
import type { ConsistData, ConsistErrors, StdcmItineraryProps } from '../../types';
import StdcmCardMarkerIcon from '../StdcmCardMarkerIcon';

type StdcmViasProps = StdcmItineraryProps & {
  skipAnimation: boolean;
  initialConsist: ConsistData;
  initialConsistErrors: ConsistErrors;
  onHasViaConsistErrorsChange: (errors: ConsistErrors[]) => void;
};

const StdcmVias = ({
  disabled = false,
  isDebugMode,
  skipAnimation,
  onItineraryChange,
  initialConsist,
  initialConsistErrors,
  onHasViaConsistErrorsChange,
}: StdcmViasProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const pathSteps = useSelector(getStdcmPathSteps);

  const [newIntermediateOpIndex, setNewIntermediateOpIndex] = useState<number>();

  const consistErrorsByStep = useRef<Record<string, ConsistErrors>>({});

  const intermediatePoints = useMemo(
    () => pathSteps.slice(1, -1),
    [pathSteps]
  ) as StdcmViaPathStep[];

  const cleanupConsistErrors = (pathStepId: string) => {
    delete consistErrorsByStep.current[pathStepId];
    onHasViaConsistErrorsChange(Object.values(consistErrorsByStep.current));
  };

  const updateStopType = (newStopType: StdcmStopTypes, pathStep: StdcmViaPathStep) => {
    let defaultStopTime: Duration | undefined;
    if (newStopType === StdcmStopTypes.DRIVER_SWITCH) {
      defaultStopTime = new Duration({ minutes: 3 });
    } else if (newStopType === StdcmStopTypes.SERVICE_STOP) {
      defaultStopTime = Duration.zero;
    }

    let newConsistChange = pathStep.consistChange;
    if (newStopType !== StdcmStopTypes.SERVICE_STOP && pathStep.consistChange) {
      // Disable consist change
      newConsistChange = undefined;

      cleanupConsistErrors(pathStep.id);
    }

    dispatch(
      updateStdcmPathStep({
        id: pathStep.id,
        updates: {
          stopType: newStopType,
          stopFor: defaultStopTime,
          consistChange: newConsistChange,
        },
      })
    );
  };

  /**
   * As the new intermediateOp block animates, we want to scroll to keep the box in the viewport.
   * To do so, we install an animation frame listener (requestAnimationFrame) which updates the scroll position
   * each time an animation frame is triggered.
   * An animation end listener is also installed to cancel the animation frame listener.
   * To properly clean up when the component is unmounted, we return a cleanup function that removes both listeners.
   */
  useLayoutEffect(() => {
    if (!newIntermediateOpIndex) return undefined;

    const newElement = document.querySelector(
      `.stdcm-vias-bundle:nth-child(${newIntermediateOpIndex}) > :last-child`
    );

    if (!newElement) return undefined;

    let requestId: number;

    const scrollWithAnimation = () => {
      newElement.scrollIntoView({
        block: 'nearest',
        behavior: 'auto',
      });

      requestId = requestAnimationFrame(scrollWithAnimation);
    };

    requestId = requestAnimationFrame(scrollWithAnimation);

    const newElementCIInput: HTMLInputElement | null = newElement.querySelector('.ci-input input');

    if (newElementCIInput) newElementCIInput.focus({ preventScroll: true });

    const handleAnimationEnd = () => {
      cancelAnimationFrame(requestId);
      setNewIntermediateOpIndex(undefined);
    };

    newElement.parentElement!.addEventListener('animationend', handleAnimationEnd);
    return () => {
      newElement.parentElement!.removeEventListener('animationend', handleAnimationEnd);
      cancelAnimationFrame(requestId);
    };
  }, [newIntermediateOpIndex]);

  const deleteViaOnClick = (pathStepId: string) => {
    cleanupConsistErrors(pathStepId);
    dispatch(deleteStdcmVia(pathStepId));
    onItineraryChange();
  };

  const addViaOnClick = (pathStepIndex: number) => {
    dispatch(addStdcmVia(pathStepIndex));
    setNewIntermediateOpIndex(pathStepIndex);
    onItineraryChange();
  };

  const getPreviousConsistChange = (index: number): ConsistData => {
    for (let i = index - 1; i >= 0; i--) {
      if (intermediatePoints[i].consistChange) {
        return { ...intermediatePoints[i].consistChange };
      }
    }

    return initialConsist;
  };

  const addConsistChange = (viaPathStep: StdcmViaPathStep, index: number) => {
    const previousConsistChange = getPreviousConsistChange(index);
    dispatch(
      updateStdcmPathStep({
        id: viaPathStep.id,
        updates: {
          consistChange: previousConsistChange,
        },
      })
    );
  };

  const removeConsistChange = (viaPathStep: StdcmViaPathStep) => {
    cleanupConsistErrors(viaPathStep.id);

    dispatch(
      updateStdcmPathStep({
        id: viaPathStep.id,
        updates: {
          consistChange: undefined,
        },
      })
    );
  };

  const handleConsistErrors = (id: string, errors: ConsistErrors) => {
    consistErrorsByStep.current[id] = errors;
    onHasViaConsistErrorsChange(Object.values(consistErrorsByStep.current));
  };

  const hasConsistsErrors = (): boolean | undefined => {
    const invalidConsistsFields = getInvalidFields([
      initialConsistErrors,
      ...Object.values(consistErrorsByStep.current),
    ]);
    const missingConsistsFields = filterMissingFields({
      totalMass: initialConsist.totalMass,
      totalLength: initialConsist.totalLength,
      maxSpeed: initialConsist.maxSpeed,
      vias: pathSteps,
      missingFields: [
        'totalMass',
        'totalLength',
        'maxSpeed',
        'viaConsistTotalMass',
        'viaConsistTotalLength',
      ],
    });

    return invalidConsistsFields.length !== 0 || missingConsistsFields.length !== 0;
  };

  return (
    <div className="stdcm-vias-list">
      {intermediatePoints.map((pathStep, index) => {
        if (!pathStep.isVia) return null;
        const pathStepIndex = index + 1;
        return (
          <div
            data-testid="stdcm-via-card"
            className={cx('stdcm-vias-bundle', {
              animated: pathStepIndex === newIntermediateOpIndex && !skipAnimation,
            })}
            key={pathStep.id}
          >
            <StdcmDefaultCard
              className="add-via"
              testId="add-via"
              tip="bottom"
              text={t('trainPath.addVia')}
              Icon={<Location size="lg" variant="base" />}
              onClick={() => addViaOnClick(pathStepIndex)}
              disabled={disabled}
            />
            {/* TODO #15344: remove isDebugMode */}
            {isDebugMode &&
              pathStep.stopType === StdcmStopTypes.SERVICE_STOP &&
              (!pathStep.consistChange ? (
                <StdcmDefaultCard
                  testId="edit-consist"
                  className="edit-consist"
                  disabled={hasConsistsErrors() || disabled}
                  tip="right"
                  text={t('trainPath.consistChange.add')}
                  tooltip={
                    hasConsistsErrors() ? t('trainPath.consistChange.fixErrorsFirst') : undefined
                  }
                  Icon={<Container size="lg" variant="base" />}
                  onClick={() => addConsistChange(pathStep, index)}
                />
              ) : (
                <>
                  <StdcmConsist
                    disabled={disabled}
                    isDebugMode={isDebugMode}
                    onConsistErrorsChange={(errors) => handleConsistErrors(pathStep.id, errors)}
                    consist={pathStep.consistChange ?? {}}
                    onConsistChange={(newConsist) =>
                      dispatch(
                        updateStdcmPathStep({
                          id: pathStep.id,
                          updates: { consistChange: newConsist },
                        })
                      )
                    }
                    isConsistChange
                    onDeleteConsistChange={() => removeConsistChange(pathStep)}
                  />
                  <div className="stdcm__separator" />
                </>
              ))}
            <StdcmCard
              name={t('trainPath.vias')}
              title={
                <div data-testid="stdcm-via-icons" className="stdcm-via-icons">
                  <button
                    data-testid="delete-via-button"
                    type="button"
                    onClick={() => deleteViaOnClick(pathStep.id)}
                  >
                    {t('translation:common.delete')}
                  </button>
                  <StdcmCardMarkerIcon markerIndex={pathStepIndex + 1} />
                </div>
              }
              tip="bottom"
              disabled={disabled}
              className="via"
              testId="via"
            >
              <StdcmOperationalPoint
                operationalPoint={pathStep.operationalPoint}
                pathStepId={pathStep.id}
                disabled={disabled}
                onItineraryChange={onItineraryChange}
              />
              <StdcmStopType
                stopTypes={pathStep.stopType}
                updatePathStepStopType={(newStopType) => updateStopType(newStopType, pathStep)}
              />
              {pathStep.stopType !== StdcmStopTypes.PASSAGE_TIME && (
                <StopDurationInput pathStep={pathStep} />
              )}
            </StdcmCard>
          </div>
        );
      })}
      <StdcmDefaultCard
        className="add-via"
        testId="add-via"
        tip="bottom"
        text={t('trainPath.addVia')}
        Icon={<Location size="lg" variant="base" />}
        onClick={() => addViaOnClick(pathSteps.length - 1)}
        disabled={disabled}
      />
    </div>
  );
};

export default StdcmVias;
