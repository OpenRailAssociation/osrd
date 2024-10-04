import { useMemo } from 'react';

import { Location } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import IntermediatePointIcon from 'assets/pictures/stdcmV2/intermediate-point.svg';
import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { addElementAtIndex, replaceElementAtIndex } from 'utils/array';

import StdcmCard from './StdcmCard';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmInputVia from './StdcmInputVia';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmStopType from './StdcmStopType';
import { StdcmStopTypes } from '../types';
import type { StdcmConfigCardProps } from '../types';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';

const StdcmVias = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getStdcmPathSteps } = useOsrdConfSelectors() as StdcmConfSelectors;
  const { deleteStdcmVia: deleteVia, updateStdcmPathSteps: updatePathSteps } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const pathSteps = useSelector(getStdcmPathSteps);

  const intermediatePoints = useMemo(() => pathSteps.slice(1, -1), [pathSteps]);

  const updatePathStepsList = (pathStep: StdcmPathStep | null, index: number) => {
    if (!pathStep) return;

    const newPathSteps = replaceElementAtIndex(pathSteps, index, pathStep);
    dispatch(updatePathSteps(newPathSteps));
  };

  const updateStopType = (newStopType: StdcmStopTypes, index: number) => {
    const pathStep = pathSteps[index];
    if (!pathStep) return;

    const defaultStopTime = newStopType === StdcmStopTypes.DRIVER_SWITCH ? '3' : '';
    const newPathStep = { ...pathStep, stopType: newStopType, stopFor: defaultStopTime };
    const newPathSteps = replaceElementAtIndex(pathSteps, index, newPathStep);
    dispatch(updatePathSteps(newPathSteps));
  };

  const deleteViaOnClick = (index: number) => {
    dispatch(deleteVia(index));
  };

  const addViaOnClick = (pathStepIndex: number) => {
    const newPathSteps = addElementAtIndex(pathSteps, pathStepIndex, {
      id: nextId(),
      stopType: StdcmStopTypes.PASSAGE_TIME,
    });
    dispatch(updatePathSteps(newPathSteps));
  };

  return (
    <div className="stdcm-v2-vias-list">
      {intermediatePoints.length > 0 &&
        intermediatePoints.map((pathStep, index) => {
          const pathStepIndex = index + 1;
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
                    <button type="button" onClick={() => deleteViaOnClick(index)}>
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
                    pathStep={pathStep}
                    disabled={disabled}
                  />
                </div>
                <StdcmStopType
                  stopType={pathStep.stopType || StdcmStopTypes.PASSAGE_TIME}
                  updatePathStepStopType={(newStopType) =>
                    updateStopType(newStopType, pathStepIndex)
                  }
                />
                {pathStep.stopType && pathStep.stopType !== StdcmStopTypes.PASSAGE_TIME && (
                  <StdcmInputVia stopType={pathStep.stopType} pathStep={pathStep} />
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
