import { useEffect, useMemo, useState } from 'react';

import { Location } from '@osrd-project/ui-icons';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import IntermediatePointIcon from 'assets/pictures/stdcmV2/intermediate-point.svg';
import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { addElementAtIndex, replaceElementAtIndex } from 'utils/array';
import { formatDurationAsISO8601 } from 'utils/timeManipulation';

import StdcmCard from './StdcmCard';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmInputVia from './StdcmInputVia';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmStopType from './StdcmStopType';
import { StdcmStopTypes } from '../types';
import type { StdcmConfigCardProps } from '../types';

const StdcmVias = ({ disabled = false, setCurrentSimulationInputs }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getPathSteps } = useOsrdConfSelectors();
  const { deleteVia, updatePathSteps, updateViaStopTime } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const pathSteps = useSelector(getPathSteps);

  const [stopTypes, setStopTypes] = useState<Record<string, StdcmStopTypes>>(
    compact(pathSteps).reduce(
      (acc, cur) => {
        acc[cur.id] = StdcmStopTypes.PASSAGE_TIME;
        return acc;
      },
      {} as Record<string, StdcmStopTypes>
    )
  );

  const intermediatePoints = useMemo(() => pathSteps.slice(1, -1), [pathSteps]);

  const updatePathStepsList = (pathStep: PathStep | null, index: number) => {
    if (!pathStep) return;

    const newPathSteps = replaceElementAtIndex(pathSteps, index, pathStep);
    dispatch(updatePathSteps({ pathSteps: newPathSteps }));
  };

  const updatePathStepStopTime = (stopTime: string, index: number, pathStepId: string) => {
    const pathStepToUpdate = pathSteps[index];
    if (!pathStepToUpdate) return;
    dispatch(
      updateViaStopTime({
        via: pathStepToUpdate,
        duration: formatDurationAsISO8601(Number(stopTime) * 60),
        stopType: stopTypes[pathStepId],
      })
    );
  };

  const updateStopType = (newStopType: StdcmStopTypes, index: number, pathStepId: string) => {
    setStopTypes((prevStopTypes) => {
      const updatedStopTypes = {
        ...prevStopTypes,
        [pathStepId]: newStopType,
      };

      const defaultStopTime = newStopType === StdcmStopTypes.DRIVER_SWITCH ? '3' : '';
      updatePathStepStopTime(defaultStopTime, index, pathStepId);

      return updatedStopTypes;
    });
  };

  useEffect(() => {
    pathSteps.forEach((pathStep, index) => {
      const stopType = stopTypes[index];
      if (pathStep && stopType && pathStep.stopType !== stopType) {
        const updatedPathStep = {
          ...pathStep,
          stopType,
        };
        updatePathStepsList(updatedPathStep, index);
      }
    });
  }, [stopTypes, pathSteps]);

  const deleteViaOnClick = (index: number, pathStepId: string) => {
    setStopTypes((prevStopTypes) => {
      delete prevStopTypes[pathStepId];
      return prevStopTypes;
    });
    dispatch(deleteVia(index));
  };

  const addViaOnClick = (pathStepIndex: number) => {
    const newPathSteps = addElementAtIndex(pathSteps, pathStepIndex, { id: nextId(), uic: -1 });
    dispatch(updatePathSteps({ pathSteps: newPathSteps }));
  };

  useEffect(() => {
    setCurrentSimulationInputs((prevState) => ({
      ...prevState,
      pathSteps,
    }));
  }, [pathSteps]);

  return (
    <div className="stdcm-v2-vias-list">
      {intermediatePoints.length > 0 &&
        intermediatePoints.map((pathStep, index) => {
          const pathStepIndex = index + 1;
          if (!pathStep) return null;
          return (
            <div className="stdcm-v2-vias-bundle" key={pathStep.id}>
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
                  <div className="stdcm-v2-via-icons">
                    <div className="icon-bundle mt-1">
                      <img src={IntermediatePointIcon} alt="intermediate-point" />
                      <span className="icon-index">{pathStepIndex}</span>
                    </div>
                    <button type="button" onClick={() => deleteViaOnClick(index, pathStep.id)}>
                      {t('translation:common.delete')}
                    </button>
                  </div>
                }
                hasTip
                disabled={disabled}
              >
                <div className="stdcm-v2-vias">
                  <StdcmOperationalPoint
                    updatePoint={(e) => updatePathStepsList(e, pathStepIndex)}
                    point={pathStep}
                    opPointId={pathStep.id}
                    disabled={disabled}
                  />
                </div>
                {'uic' in pathStep && pathStep.uic !== -1 && (
                  <>
                    <StdcmStopType
                      stopTypes={stopTypes[pathStep.id]}
                      updatePathStepStopType={(newStopType) =>
                        updateStopType(newStopType, pathStepIndex, pathStep.id)
                      }
                    />
                    <StdcmInputVia
                      stopType={stopTypes[pathStep.id]}
                      pathStep={pathStep}
                      updatePathStepStopTime={(e) =>
                        updatePathStepStopTime(e, pathStepIndex, pathStep.id)
                      }
                    />
                  </>
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
