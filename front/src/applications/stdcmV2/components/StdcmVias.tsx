import { useMemo } from 'react';

import { Location } from '@osrd-project/ui-icons';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import IntermediatePointIcon from 'assets/pictures/stdcmV2/intermediate-point.svg';
import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

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
  const {
    deleteStdcmVia: deleteVia,
    updateStdcmPathStep,
    addStdcmVia,
  } = useOsrdConfActions() as StdcmConfSliceActions;
  const pathSteps = useSelector(getStdcmPathSteps);

  const intermediatePoints = useMemo(() => pathSteps.slice(1, -1), [pathSteps]);

  const updatePathStepsList = (pathStep: StdcmPathStep) => {
    dispatch(updateStdcmPathStep(pathStep));
  };

  const updateStopType = (newStopType: StdcmStopTypes, pathStep: StdcmPathStep) => {
    const defaultStopTime = newStopType === StdcmStopTypes.DRIVER_SWITCH ? '3' : '';
    const newPathStep = { ...pathStep, stopType: newStopType, stopFor: defaultStopTime };
    dispatch(updateStdcmPathStep(newPathStep));
  };

  const updateViaLocation = (newLocation: StdcmPathStep['location'], pathStep: StdcmPathStep) => {
    const newPathStep = { ...pathStep, location: newLocation };
    updatePathStepsList(newPathStep);
  };

  const deleteViaOnClick = (pathStepId: string) => {
    dispatch(deleteVia(pathStepId));
  };

  const addViaOnClick = (pathStepIndex: number) => {
    dispatch(addStdcmVia(pathStepIndex));
  };

  return (
    <div className="stdcm-v2-vias-list">
      {intermediatePoints.length > 0 &&
        compact(intermediatePoints).map((pathStep, index) => {
          if (!pathStep.isVia) {
            throw new Error('Path step is not a via');
          }
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
                    <button type="button" onClick={() => deleteViaOnClick(pathStep.id)}>
                      {t('translation:common.delete')}
                    </button>
                  </div>
                }
                hasTip
                disabled={disabled}
                className="via"
              >
                {(!pathStep.location || 'uic' in pathStep.location) && (
                  <StdcmOperationalPoint
                    updatePathStepLocation={(e) => updateViaLocation(e, pathStep)}
                    pathStepId={pathStep.id}
                    pathStepLocation={pathStep.location}
                    disabled={disabled}
                  />
                )}
                <StdcmStopType
                  stopType={pathStep.stopType || StdcmStopTypes.PASSAGE_TIME}
                  updatePathStepStopType={(newStopType) => updateStopType(newStopType, pathStep)}
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
