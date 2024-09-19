import { useEffect, useMemo } from 'react';

import { Location } from '@osrd-project/ui-icons';
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
import type { StdcmConfigCardProps } from '../types';

const StdcmVias = ({ disabled = false, setCurrentSimulationInputs }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getPathSteps } = useOsrdConfSelectors();
  const { deleteVia, updatePathSteps, updateViaStopTime } =
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
      updateViaStopTime({
        via: pathStepToUpdate,
        duration: formatDurationAsISO8601(Number(stopTime) * 60),
      })
    );
  };

  const deleteViaOnClick = (index: number) => {
    dispatch(deleteVia(index));
  };

  const addViaOnClick = (pathStepIndex: number) => {
    const newPathSteps = addElementAtIndex(pathSteps, pathStepIndex, null);
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
          return (
            <>
              <StdcmDefaultCard
                hasTip
                text={t('trainPath.addVia')}
                Icon={<Location size="lg" variant="base" />}
                onClick={() => addViaOnClick(pathStepIndex)}
                disabled={disabled}
              />
              <StdcmCard
                key={nextId('via-')}
                name={t('trainPath.vias')}
                title={
                  <div className="stdcm-v2-via-icons">
                    <div className="icon-bundle mt-1">
                      <span>
                        <img
                          src={IntermediatePointIcon}
                          alt="intermediate-point"
                          style={{ width: '45px' }}
                        />
                      </span>
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
                    point={pathStep}
                    opPointId={pathStep?.id || nextId('via-')}
                    disabled={disabled}
                  />
                </div>
                {pathStep && (
                  <StdcmInputVia
                    pathStep={pathStep}
                    updatePathStepStopTime={(e) => updatePathStepStopTime(e, pathStepIndex)}
                  />
                )}
              </StdcmCard>
            </>
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
