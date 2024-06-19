import React, { useEffect } from 'react';

import { useTranslation } from 'react-i18next';
// import { Input } from '@osrd-project/ui-core';

import { type LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { type SelectOptionObject } from 'common/BootstrapSNCF/SelectSNCF';
import { useOsrdConfActions } from 'common/osrdContext';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import StdcmCard from './StdcmCard';
import StdcmSuggestions from './StdcmSuggestions';
import type { StdcmConfigCardProps } from '../types';

type StdcmSuggestionsConsistOption = SelectOptionObject &
  Omit<LightRollingStockWithLiveries, 'id'> & {
    value: LightRollingStockWithLiveries;
  };

const ConsistCardTitle = ({
  rollingStock,
}: {
  rollingStock?: LightRollingStockWithLiveries | null;
}) => {
  if (!rollingStock) return null;

  return (
    <div className="stdcm-v2-consist-img w-75 d-flex justify-content-end align-self-end">
      <RollingStock2Img rollingStock={rollingStock} />
    </div>
  );
};

const StdcmConsist = ({ setCurrentSimulationInputs, disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag } =
    useStoreDataForSpeedLimitByTagSelector();

  const { updateRollingStockID } = useOsrdConfActions() as StdcmConfSliceActions;
  const dispatch = useAppDispatch();

  const { rollingStock } = useStoreDataForRollingStockSelector();

  const { filters, searchRollingStock, filteredRollingStockList } = useFilterRollingStock();

  const getLabel = (rs: LightRollingStockWithLiveries) => {
    let res = '';
    const { metadata, name } = rs;

    if (metadata) {
      const series = metadata.series ?? metadata.reference;
      const subseries =
        metadata.series && metadata.series !== metadata.subseries
          ? metadata.subseries
          : metadata.detail;
      if (series) res += series;
      if (subseries) res += series ? ` (${subseries})` : subseries;
    }
    if (name) res += ` -- ${name}`;
    return res;
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    searchRollingStock(e.target.value);
  };

  const onInputOnBlur = () => {
    if (filteredRollingStockList.length === 1) {
      dispatch(updateRollingStockID(filteredRollingStockList[0].id));
    } else {
      dispatch(updateRollingStockID(undefined));
    }
  };

  const onSelectSuggestion = (option: StdcmSuggestionsConsistOption) => {
    dispatch(updateRollingStockID(option.value.id));
  };

  useEffect(() => {
    if (rollingStock) {
      searchRollingStock(getLabel(rollingStock));
    } else {
      searchRollingStock('');
    }
    setCurrentSimulationInputs((prevState) => ({
      ...prevState,
      consist: {
        tractionEngine: rollingStock,
      },
    }));
  }, [rollingStock]);

  return (
    <StdcmCard
      name={t('consist.consist')}
      title={<ConsistCardTitle rollingStock={rollingStock} />}
      disabled={disabled}
    >
      <div className="stdcm-v2-consist">
        <div className="suggestions">
          <StdcmSuggestions
            id="tractionEngine"
            label={t('consist.tractionEngine')}
            value={filters.text.toUpperCase()}
            onChange={onInputChange}
            onBlur={onInputOnBlur}
            disabled={disabled}
            options={filteredRollingStockList.map((rs) => ({
              value: rs,
              label: getLabel(rs),
              ...rs,
              id: rs.id.toString(),
            }))}
            onSelectSuggestion={onSelectSuggestion}
          />
        </div>
        {/* <div className="stdcm-v2-consist__properties d-flex justify-content-between">
          <Input id="tonnage" label="Tonnage" trailingContent="t" disabled />
          <Input id="Longueur" label="longueur" trailingContent="m" disabled />
        </div> */}
        <p className="stdcm-v2-consist__title">{t('translation:Editor.nav.speed-limits')}</p>
        <SpeedLimitByTagSelector
          disabled={disabled}
          selectedSpeedLimitByTag={speedLimitByTag}
          speedLimitsByTags={speedLimitsByTags}
          dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
        />
      </div>
    </StdcmCard>
  );
};

export default StdcmConsist;
