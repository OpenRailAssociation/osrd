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
import { addElementAtIndex } from 'utils/array';

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

  const updatePathStepsList = (pathStep: StdcmPathStep) => {
    const newPathSteps = pathSteps.map((p) => (p.id === pathStep.id ? pathStep : p));
    dispatch(updatePathSteps(newPathSteps));
  };

  const updateStopType = (newStopType: StdcmStopTypes, pathStep: StdcmPathStep) => {
    const defaultStopTime = newStopType === StdcmStopTypes.DRIVER_SWITCH ? '3' : '';
    const newPathStep = { ...pathStep, stopType: newStopType, stopFor: defaultStopTime };
    updatePathStepsList(newPathStep);
  };

  const updateViaLocation = (newLocation: StdcmPathStep['location'], pathStep: StdcmPathStep) => {
    const newPathStep = { ...pathStep, location: newLocation };
    updatePathStepsList(newPathStep);
  };

  const deleteViaOnClick = (index: number) => {
    dispatch(deleteVia(index));
  };

  const addViaOnClick = (pathStepIndex: number) => {
    const newPathSteps = addElementAtIndex(pathSteps, pathStepIndex, {
      id: nextId(),
      stopType: StdcmStopTypes.PASSAGE_TIME,
      isVia: true,
    });
    dispatch(updatePathSteps(newPathSteps));
  };

  return (
    <div className="stdcm-v2-vias-list">
      {intermediatePoints.length > 0 &&
        intermediatePoints.map((pathStep, index) => {
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
                    <button type="button" onClick={() => deleteViaOnClick(index)}>
                      {t('translation:common.delete')}
                    </button>
                  </div>
                }
                hasTip
                disabled={disabled}
              >
                {(!pathStep.location || 'uic' in pathStep.location) && (
                  <div className="stdcm-v2-vias">
                    <StdcmOperationalPoint
                      updatePathStepLocation={(e) => updateViaLocation(e, pathStep)}
                      pathStepId={pathStep.id}
                      pathStepLocation={pathStep.location}
                      disabled={disabled}
                    />
                  </div>
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
