/* eslint-disable no-restricted-syntax */
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updatePowerRestriction } from 'reducers/osrdconf';
import icon from 'assets/pictures/components/power_restrictions.svg';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { getRollingStockID, getPowerRestriction } from 'reducers/osrdconf/selectors';
import { osrdEditoastApi, LightRollingStock } from 'common/api/osrdEditoastApi';

type selectorOption = { key: string | undefined; value: string | undefined };

export default function PowerRestrictionSelector() {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useDispatch();
  const rollingStockID: number | undefined = useSelector(getRollingStockID);
  const powerRestriction = useSelector(getPowerRestriction);
  const [powerRestrictions, setPowerRestrictions] = useState<selectorOption[] | undefined>();
  const [getRollingStockById] = osrdEditoastApi.endpoints.getLightRollingStockById.useLazyQuery({});

  const getPowerRestrictionsList = async (rollingStockInfo: LightRollingStock) => {
    if (rollingStockInfo.power_restrictions) {
      const powerRestrictionsList = Object.entries(rollingStockInfo.power_restrictions).map(
        ([key, _]: [string | undefined, string]) => ({ key, value: key })
      );
      if (powerRestrictionsList.length > 0) {
        powerRestrictionsList.unshift({ key: undefined, value: t('noPowerRestriction') });
      }
      setPowerRestrictions(powerRestrictionsList);
    }
  };

  useEffect(() => {
    if (rollingStockID) {
      dispatch(updatePowerRestriction(undefined));
      getRollingStockById({ id: rollingStockID })
        .unwrap()
        .then((rollingStockInfo) => {
          getPowerRestrictionsList(rollingStockInfo);
        });
      setPowerRestrictions(undefined);
    }
  }, [rollingStockID]);

  return powerRestrictions && powerRestrictions.length > 0 ? (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container">
        <img width="32px" className="mr-2" src={icon} alt="PowerRestrictionIcon" />
        <span className="text-muted">{t('powerRestriction')}</span>
        <SelectImprovedSNCF
          sm
          options={powerRestrictions}
          onChange={(e: selectorOption) => dispatch(updatePowerRestriction(e.key))}
          selectedValue={powerRestriction || t('noPowerRestriction')}
        />
      </div>
    </div>
  ) : null;
}
