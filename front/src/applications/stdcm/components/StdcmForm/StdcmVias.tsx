import { useEffect, useMemo, useState } from 'react';

import { Location } from '@osrd-project/ui-icons';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import IntermediatePointIcon from 'assets/pictures/stdcm/intermediate-point.svg';
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
import { StdcmStopTypes } from '../../types';
import type { StdcmConfigCardProps } from '../../types';

const generateUniqueId = (idsList: string[]): string => {
  let id;
  do {
    id = nextId();
  } while (idsList.includes(id));
  return id;
};

const StdcmVias = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getPathSteps } = useOsrdConfSelectors();
  const { deleteVia, updatePathSteps, updateViaStopTime } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const pathSteps = useSelector(getPathSteps);

  const [stopTypes, setStopTypes] = useState<Record<string, StdcmStopTypes>>(
    compact(pathSteps).reduce(
      (acc, cur) => {
        acc[cur.id] = cur.stopType || StdcmStopTypes.PASSAGE_TIME;
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
    setStopTypes((prevStopTypes) => ({
      ...prevStopTypes,
      [pathStepId]: newStopType,
    }));
    const defaultStopTime = newStopType === StdcmStopTypes.DRIVER_SWITCH ? '3' : '';
    updatePathStepStopTime(defaultStopTime, index, pathStepId);
  };

  const deleteViaOnClick = (index: number, pathStepId: string) => {
    setStopTypes((prevStopTypes) => {
      delete prevStopTypes[pathStepId];
      return prevStopTypes;
    });
    dispatch(deleteVia(index));
  };

  const addViaOnClick = (pathStepIndex: number) => {
    const newPathStepId = generateUniqueId(pathSteps.map((pathStep) => pathStep?.id || ''));
    const newPathSteps = addElementAtIndex(pathSteps, pathStepIndex, {
      id: newPathStepId,
      uic: -1,
    });
    setStopTypes((prevStopTypes) => ({
      ...prevStopTypes,
      [newPathStepId]: StdcmStopTypes.PASSAGE_TIME,
    }));
    dispatch(updatePathSteps({ pathSteps: newPathSteps }));
  };

  useEffect(() => {
    pathSteps.forEach((pathStep, index) => {
      if (pathStep) {
        const stopType = stopTypes[pathStep.id];
        if (stopType && pathStep.stopType !== stopType) {
          const updatedPathStep = {
            ...pathStep,
            stopType,
          };
          updatePathStepsList(updatedPathStep, index);
        }
      }
    });
  }, [stopTypes, pathSteps]);

  return (
    <div className="stdcm-vias-list">
      {intermediatePoints.length > 0 &&
        compact(intermediatePoints).map((pathStep, index) => {
          const pathStepIndex = index + 1;
          return (
            <div className="stdcm-vias-bundle" key={pathStep.id}>
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
                  <div className="stdcm-via-icons">
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
                className="via"
              >
                <StdcmOperationalPoint
                  updatePoint={(e) => updatePathStepsList(e, pathStepIndex)}
                  point={pathStep}
                  opPointId={pathStep.id}
                  disabled={disabled}
                />
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
                      stopDuration={pathStep.stopFor}
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
