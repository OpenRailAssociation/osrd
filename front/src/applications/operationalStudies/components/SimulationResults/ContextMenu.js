import React from 'react';
import {
  updateAllowancesSettings,
  updateContextMenu,
  updateMustRedraw,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { useTranslation } from 'react-i18next';

export default function ContextMenu() {
  const { contextMenu, allowancesSettings, selectedTrain } = useSelector(
    (state) => state.osrdsimulation
  );
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const { t } = useTranslation(['translation', 'simulation', 'allowances']);
  const dispatch = useDispatch();

  const closeContextMenu = () => {
    dispatch(updateContextMenu(undefined));
  };

  const changeAllowancesSettings = (type) => {
    dispatch(
      updateAllowancesSettings({
        ...allowancesSettings,
        [simulation.trains[selectedTrain].id]: {
          ...allowancesSettings[simulation.trains[selectedTrain].id],
          [type]: !allowancesSettings[simulation.trains[selectedTrain].id][type],
        },
      })
    );
    dispatch(updateMustRedraw(true));
  };

  const changeAllowancesSettingsRadio = (type) => {
    dispatch(
      updateAllowancesSettings({
        ...allowancesSettings,
        [simulation.trains[selectedTrain].id]: {
          ...allowancesSettings[simulation.trains[selectedTrain].id],
          baseBlocks: type === 'baseBlocks',
          allowancesBlocks: type === 'allowancesBlocks',
          ecoBlocks: type === 'ecoBlocks',
        },
      })
    );
    dispatch(updateMustRedraw(true));
  };

  return contextMenu ? (
    <div
      className="get-context-menu dropdown show dropright"
      style={{
        position: 'absolute',
        top: contextMenu.yPos - 20,
        left: contextMenu.xPos + 10,
      }}
    >
      <div className="dropdown-menu show">
        {simulation.trains[selectedTrain].allowances || simulation.trains[selectedTrain].eco ? (
          <div className="row">
            <div className="col-3 font-weight-medium mb-1">{t('allowances:blocks')}</div>
            <div className="col-9 font-weight-medium mb-1">{t('allowances:trainSchedules')}</div>
            <div className="col-3">
              <CheckboxRadioSNCF
                id="occupation-base-blocks"
                name="occupation-blocks"
                type="radio"
                label="&nbsp;"
                onChange={() => changeAllowancesSettingsRadio('baseBlocks')}
                checked={allowancesSettings[simulation.trains[selectedTrain].id].baseBlocks}
              />
            </div>
            <div className="col-9">
              <CheckboxRadioSNCF
                id="occupation-base"
                name="occupation-base"
                type="checkbox"
                onChange={() => changeAllowancesSettings('base')}
                label={t('allowances:baseTrainSchedule')}
                checked={allowancesSettings[simulation.trains[selectedTrain].id].base}
              />
            </div>
            {simulation.trains[selectedTrain].allowances && (
              <>
                <div className="col-3">
                  <CheckboxRadioSNCF
                    id="occupation-allowances-blocks"
                    name="occupation-blocks"
                    type="radio"
                    label="&nbsp;"
                    onChange={() => changeAllowancesSettingsRadio('allowancesBlocks')}
                    checked={
                      allowancesSettings[simulation.trains[selectedTrain].id].allowancesBlocks
                    }
                  />
                </div>
                <div className="col-9">
                  <CheckboxRadioSNCF
                    id="occupation-allowances"
                    name="occupation-allowances"
                    type="checkbox"
                    onChange={() => changeAllowancesSettings('allowances')}
                    label={t('allowances:margedTrainSchedule')}
                    checked={allowancesSettings[simulation.trains[selectedTrain].id].allowances}
                  />
                </div>
              </>
            )}
            {simulation.trains[selectedTrain].eco && (
              <>
                <div className="col-3">
                  <CheckboxRadioSNCF
                    id="occupation-eco-blocks"
                    name="occupation-blocks"
                    type="radio"
                    label="&nbsp;"
                    onChange={() => changeAllowancesSettingsRadio('ecoBlocks')}
                    checked={allowancesSettings[simulation.trains[selectedTrain].id].ecoBlocks}
                  />
                </div>
                <div className="col-9">
                  <CheckboxRadioSNCF
                    id="occupation-eco"
                    name="occupation-eco"
                    type="checkbox"
                    onChange={() => changeAllowancesSettings('eco')}
                    label={t('allowances:ecoTrainSchedule')}
                    checked={allowancesSettings[simulation.trains[selectedTrain].id].eco}
                  />
                </div>
              </>
            )}
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-block btn-sm"
          onClick={closeContextMenu}
        >
          {t('translation:common.cancel')}
        </button>
      </div>
    </div>
  ) : null;
}
