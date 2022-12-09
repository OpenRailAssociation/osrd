import { ComponentType, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateMustRedraw, updateSpeedSpaceSettings } from 'reducers/osrdsimulation/actions';
import Allowances from './Allowances';
import { AnyAction } from 'redux';

// Initialy try to implement https://react-typescript-cheatsheet.netlify.app/docs/hoc/, no success

function withOSRDData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['allowances']);
    const dispatch = useDispatch();
    const simulation = useSelector((state: any) => state.osrdsimulation.simulation.present);
    const allowancesSettings = useSelector((state: any) => state.osrdsimulation.allowancesSettings);
    const selectedProjection = useSelector((state: any) => state.osrdsimulation.selectedProjection);
    const selectedTrain = useSelector((state: any) => state.osrdsimulation.selectedTrain);
    return (
      <Component
        {...(hocProps as T)}
        t={t}
        dispatch={dispatch}
        simulation={simulation}
        allowanceSettings={allowancesSettings}
        selectedProjection={selectedProjection}
        selectedTrain={selectedTrain}
      />
    );
  };
}

export default withOSRDData(Allowances);
