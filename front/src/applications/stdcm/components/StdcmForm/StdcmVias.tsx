import { useMemo } from 'react';

import { Location } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import IntermediatePointIcon from 'assets/pictures/stdcm/intermediate-point.svg';
import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { formatDurationAsISO8601 } from 'utils/timeManipulation';

import StdcmCard from './StdcmCard';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmInputVia from './StdcmInputVia';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmStopType from './StdcmStopType';
import { StdcmStopTypes } from '../../types';
import type { StdcmConfigCardProps } from '../../types';

const StdcmVias = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getStdcmPathSteps } = useOsrdConfSelectors() as StdcmConfSelectors;
  const { updateStdcmPathStep, addStdcmVia, deleteStdcmVia } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const pathSteps = useSelector(getStdcmPathSteps);

  const intermediatePoints = useMemo(() => pathSteps.slice(1, -1), [pathSteps]);

  const updateStopType = (newStopType: StdcmStopTypes, pathStep: StdcmPathStep) => {
    const defaultStopTime =
      newStopType === StdcmStopTypes.DRIVER_SWITCH ? formatDurationAsISO8601(3 * 60) : '';
    const newPathStep = { ...pathStep, stopType: newStopType, stopFor: defaultStopTime };
    dispatch(updateStdcmPathStep(newPathStep));
  };

  const updateStopDuration = (stopTime: string, pathStep: StdcmPathStep) => {
    dispatch(
      updateStdcmPathStep({ ...pathStep, stopFor: formatDurationAsISO8601(Number(stopTime) * 60) })
    );
  };

  const deleteViaOnClick = (pathStepId: string) => {
    dispatch(deleteStdcmVia(pathStepId));
  };

  const addViaOnClick = (pathStepIndex: number) => {
    dispatch(addStdcmVia(pathStepIndex));
  };

  return (
    <div className="stdcm-vias-list">
      {intermediatePoints.map((pathStep, index) => {
        if (!pathStep.isVia) return null;
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
                  <button type="button" onClick={() => deleteViaOnClick(pathStep.id)}>
                    {t('translation:common.delete')}
                  </button>
                </div>
              }
              hasTip
              disabled={disabled}
              className="via"
            >
              <StdcmOperationalPoint point={pathStep} opPointId={pathStep.id} disabled={disabled} />
              {'uic' in pathStep && pathStep.uic !== -1 && (
                <>
                  <StdcmStopType
                    stopTypes={pathStep.stopType}
                    updatePathStepStopType={(newStopType) => updateStopType(newStopType, pathStep)}
                  />
                  <StdcmInputVia
                    stopType={pathStep.stopType}
                    stopDuration={pathStep.stopFor}
                    updatePathStepStopTime={(e) => updateStopDuration(e, pathStep)}
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
