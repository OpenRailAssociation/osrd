import { useEffect } from 'react';

import { Input, ComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import StdcmCard from './StdcmCard';
import type { StdcmConfigCardProps } from '../types';

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

const StdcmConsist = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag } =
    useStoreDataForSpeedLimitByTagSelector();

  const { updateRollingStockID } = useOsrdConfActions() as StdcmConfSliceActions;
  const dispatch = useAppDispatch();

  const { rollingStock } = useStoreDataForRollingStockSelector();

  const { filters, searchRollingStock, searchRollingStockById, filteredRollingStockList } =
    useFilterRollingStock();

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

  const onInputClick = () => {
    if (rollingStock?.id !== undefined) {
      searchRollingStockById(rollingStock.id);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    searchRollingStock(e.target.value);
    if (e.target.value.trim().length === 0) {
      updateRollingStockID(undefined);
    }
  };

  const onSelectSuggestion = (option?: LightRollingStockWithLiveries) => {
    dispatch(updateRollingStockID(option?.id));
  };

  useEffect(() => {
    if (rollingStock) {
      searchRollingStock(getLabel(rollingStock));
    } else {
      searchRollingStock('');
    }
  }, [rollingStock]);

  return (
    <StdcmCard
      name={t('consist.consist')}
      title={<ConsistCardTitle rollingStock={rollingStock} />}
      disabled={disabled}
    >
      <div className="stdcm-v2-consist">
        <div className="suggestions">
          <ComboBox
            id="tractionEngine"
            label={t('consist.tractionEngine')}
            value={filters.text.toUpperCase()}
            onClick={onInputClick}
            onChange={onInputChange}
            autoComplete="off"
            disabled={disabled}
            suggestions={filteredRollingStockList}
            getSuggestionLabel={(suggestion: LightRollingStockWithLiveries) => getLabel(suggestion)}
            onSelectSuggestion={onSelectSuggestion}
          />
        </div>
        <div className="stdcm-v2-consist__properties d-flex justify-content-between">
          <Input id="tonnage" label={t('consist.tonnage')} trailingContent="t" />
          <Input id="length" label={t('consist.length')} trailingContent="m" />
        </div>
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
