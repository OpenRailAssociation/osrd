import React, { useEffect, useMemo } from 'react';

import { Location } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
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
import type { StdcmConfigCardProps } from '../types';

const StdcmVias = ({ disabled = false, setCurrentSimulationInputs }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getPathSteps } = useOsrdConfSelectors();
  const { deleteViaV2, updatePathSteps, updateViaStopTimeV2 } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const pathSteps = useSelector(getPathSteps);

  const intermediatePoints = useMemo(() => pathSteps.slice(1, -1), [pathSteps]);

  const updatePathStepsList = (pathStep: PathStep | null, index: number) => {
    const newPathSteps = replaceElementAtIndex(pathSteps, index, pathStep);
    dispatch(updatePathSteps({ pathSteps: newPathSteps }));
  };

  const updatePathStepStopTime = (stopTime: string, index: number) => {
    const pathStepToUpdate = pathSteps[index];
    if (!pathStepToUpdate) return;
    dispatch(
      updateViaStopTimeV2({
        via: pathStepToUpdate,
        duration: formatDurationAsISO8601(Number(stopTime) * 60),
      })
    );
  };

  const onClickDeleteVia = (index: number) => {
    dispatch(deleteViaV2(index));
  };

  const onClickOnCard = () => {
    const newPathSteps = addElementAtIndex(pathSteps, pathSteps.length - 1, null);
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
          const pathStepId = index + 1;
          return (
            <StdcmCard
              key={pathStepId}
              name={t('trainPath.vias')}
              title={
                <div className="stdcm-v2-via-icons">
                  <span>
                    <img src={IntermediatePointIcon} alt="intermediate-point" />
                  </span>
                  <button type="button" onClick={() => onClickDeleteVia(index)}>
                    {t('translation:common.delete')}
                  </button>
                </div>
              }
              hasTip
              disabled={disabled}
            >
              <div className="stdcm-v2-vias">
                <StdcmOperationalPoint
                  updatePoint={(e) => updatePathStepsList(e, pathStepId)}
                  point={pathStep}
                  disabled={disabled}
                />
              </div>
              {pathStep && (
                <StdcmInputVia
                  pathStep={pathStep}
                  updatePathStepStopTime={(e) => updatePathStepStopTime(e, pathStepId)}
                />
              )}
            </StdcmCard>
          );
        })}
      <StdcmDefaultCard
        hasTip
        text={t('trainPath.addVia')}
        Icon={<Location size="lg" variant="base" />}
        onClick={onClickOnCard}
        disabled={disabled}
      />
    </div>
  );
};

export default StdcmVias;
