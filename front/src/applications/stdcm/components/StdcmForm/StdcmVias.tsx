import { useLayoutEffect, useMemo, useState } from 'react';

import { Location } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import IntermediatePointIcon from 'assets/pictures/mapMarkers/intermediate-point.svg';
import { updateStdcmPathStep, deleteStdcmVia, addStdcmVia } from 'reducers/osrdconf/stdcmConf';
import { getStdcmPathSteps } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';

import StdcmCard from './StdcmCard';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmStopType from './StdcmStopType';
import StopDurationInput from './StopDurationInput';
import { StdcmStopTypes } from '../../types';
import type { StdcmItineraryProps } from '../../types';

type StdcmViasProps = StdcmItineraryProps & {
  skipAnimation: boolean;
};

const StdcmVias = ({ disabled = false, skipAnimation, onItineraryChange }: StdcmViasProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const pathSteps = useSelector(getStdcmPathSteps);

  const [newIntermediateOpIndex, setNewIntermediateOpIndex] = useState<number>();

  const intermediatePoints = useMemo(() => pathSteps.slice(1, -1), [pathSteps]);

  const updateStopType = (newStopType: StdcmStopTypes, pathStep: StdcmPathStep) => {
    let defaultStopTime: Duration | undefined;
    if (newStopType === StdcmStopTypes.DRIVER_SWITCH) {
      defaultStopTime = new Duration({ minutes: 3 });
    } else if (newStopType === StdcmStopTypes.SERVICE_STOP) {
      defaultStopTime = Duration.zero;
    }
    dispatch(
      updateStdcmPathStep({
        id: pathStep.id,
        updates: { stopType: newStopType, stopFor: defaultStopTime },
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
    dispatch(deleteStdcmVia(pathStepId));
    onItineraryChange();
  };

  const addViaOnClick = (pathStepIndex: number) => {
    dispatch(addStdcmVia(pathStepIndex));
    setNewIntermediateOpIndex(pathStepIndex);
    onItineraryChange();
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
              hasTip
              text={t('trainPath.addVia')}
              Icon={<Location size="lg" variant="base" />}
              onClick={() => addViaOnClick(pathStepIndex)}
              disabled={disabled}
            />
            <StdcmCard
              name={t('trainPath.vias')}
              title={
                <div data-testid="stdcm-via-icons" className="stdcm-via-icons">
                  <div className="icon-bundle mt-1">
                    <img src={IntermediatePointIcon} alt="intermediate-point" />
                    <span data-testid="stdcm-icon-index" className="icon-index">
                      {pathStepIndex}
                    </span>
                  </div>
                  <button
                    data-testid="delete-via-button"
                    type="button"
                    onClick={() => deleteViaOnClick(pathStep.id)}
                  >
                    {t('translation:common.delete')}
                  </button>
                </div>
              }
              hasTip
              disabled={disabled}
              className="via"
            >
              <StdcmOperationalPoint
                location={pathStep.location}
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
        hasTip
        text={t('trainPath.addVia')}
        Icon={<Location size="lg" variant="base" />}
        onClick={() => addViaOnClick(pathSteps.length - 1)}
        disabled={disabled}
      />
    </div>
  );
};

export default StdcmVias;
