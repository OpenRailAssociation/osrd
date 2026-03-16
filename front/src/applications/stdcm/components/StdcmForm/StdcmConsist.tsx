import { useEffect, useMemo, useState } from 'react';

import { Input, ComboBox, useDefaultComboBox, Select } from '@osrd-project/ui-core';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useConsistFieldStatus from 'applications/stdcm/hooks/useConsistFieldStatus';
import useFilterTowedRollingStock from 'applications/stdcm/hooks/useFilterTowedRollingStock';
import type { ConsistData, ConsistErrors } from 'applications/stdcm/types';
import calculateConsistMaxSpeed from 'applications/stdcm/utils/calculateConsistMaxSpeed';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type {
  LightRollingStockWithLiveries,
  TowedRollingStock,
  LoadingGaugeType,
} from 'common/api/osrdEditoastApi';
import SpeedLimitTagSelector from 'common/SpeedLimitTagSelector';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import {
  getTrackSectionIdsByLoadingGauge,
  getStdcmSpeedLimitsByTag,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { removeDuplicates } from 'utils/array';
import { createStandardSelectOptions } from 'utils/uiCoreHelpers';

import StdcmCard from './StdcmCard';
import useStdcmConsist from '../../hooks/useStdcmConsist';

const ConsistCardTitle = ({
  rollingStock,
}: {
  rollingStock?: LightRollingStockWithLiveries | null;
}) => {
  if (!rollingStock) return null;

  return (
    <div className="stdcm-consist-img">
      <RollingStock2Img rollingStock={rollingStock} />
    </div>
  );
};

export type StdcmConsistProps = {
  isDebugMode: boolean;
  disabled?: boolean;
  consist: ConsistData;
  onConsistChange: (consist: ConsistData) => void;
  onConsistErrorsChange: (errors: ConsistErrors) => void;
  isConsistChange?: boolean;
  onDeleteConsistChange?: () => void;
};

const GAUGES_LIST: LoadingGaugeType[] = [
  'G1',
  'G2',
  'GA',
  'GB',
  'GB1',
  'GC',
  'FR3.3',
  'FR3.3/GB/G2',
  'GLOTT',
];
const GAUGES_SET = new Set<string>(GAUGES_LIST);
const isLoadingGaugeType = (gauge: string | undefined): gauge is LoadingGaugeType =>
  typeof gauge === 'string' && GAUGES_SET.has(gauge);

const StdcmConsist = ({
  isDebugMode,
  disabled = false,
  consist,
  onConsistChange,
  onConsistErrorsChange,
  isConsistChange = false,
  onDeleteConsistChange,
}: StdcmConsistProps) => {
  const { t } = useTranslation('stdcm');

  const speedLimitsByTag = useSelector(getStdcmSpeedLimitsByTag);
  const speedLimitTags = useMemo(
    () => removeDuplicates(Object.keys(speedLimitsByTag)).sort(),
    [speedLimitsByTag]
  );
  const trackSectionIdsByLoadingGauge = useSelector(getTrackSectionIdsByLoadingGauge);
  const loadingGauges = trackSectionIdsByLoadingGauge
    ? Object.keys(trackSectionIdsByLoadingGauge)
    : [];

  const { data: rollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      consist.rollingStockID ? { rollingStockId: consist.rollingStockID } : skipToken
    );

  const { currentData: towedRollingStock } =
    osrdEditoastApi.endpoints.getTowedRollingStockByTowedRollingStockId.useQuery(
      consist.towedRollingStockID ? { towedRollingStockId: consist.towedRollingStockID } : skipToken
    );

  const [statusMessagesVisible, setStatusMessagesVisible] = useState({
    mass: true,
    length: true,
    speed: true,
  });

  const {
    onTotalMassChange,
    onTotalLengthChange,
    onMaxSpeedChange,
    onLoadingGaugeChange,
    prefillConsist,
    statusWithMessage,
    setMaxSpeedChanged,
    consistErrors,
    updateConsistErrors,
    totalMassError,
    totalLengthError,
    maxSpeedError,
  } = useStdcmConsist(consist, onConsistChange, rollingStock, towedRollingStock);

  const useFieldStatus = (field: 'totalMass' | 'totalLength' | 'maxSpeed') =>
    useConsistFieldStatus(
      field,
      statusWithMessage,
      consistErrors,
      statusMessagesVisible,
      rollingStock,
      towedRollingStock
    );

  const massFieldStatus = useFieldStatus('totalMass');
  const lengthFieldStatus = useFieldStatus('totalLength');
  const speedFieldStatus = useFieldStatus('maxSpeed');

  const { filteredRollingStockList: rollingStocks } = useFilterRollingStock({ isStdcm: true });

  const { filteredTowedRollingStockList: towedRollingStocks } = useFilterTowedRollingStock({
    isDebugMode,
  });

  const getLabel = (rs: LightRollingStockWithLiveries) => {
    const secondPart = rs.metadata?.series || rs.metadata?.reference || '';
    return secondPart ? `${rs.name} - ${secondPart}` : rs.name;
  };

  const rollingStockComboBoxDefaultProps = useDefaultComboBox(rollingStocks, getLabel);
  const towedRollingStockComboBoxDefaultProps = useDefaultComboBox(
    towedRollingStocks,
    (trs: TowedRollingStock) => trs.name
  );

  const handleRollingStockSelect = (option?: LightRollingStockWithLiveries) => {
    prefillConsist(option, towedRollingStock, consist.speedLimitByTag, {
      rollingStockID: option?.id,
    });
    setStatusMessagesVisible({
      mass: true,
      length: true,
      speed: true,
    });
  };

  const onSpeedLimitTagChange = (newTag: string | null) => {
    onConsistChange({
      ...consist,
      speedLimitByTag: newTag ?? undefined,
      maxSpeed: calculateConsistMaxSpeed(
        rollingStock,
        towedRollingStock,
        newTag ? speedLimitsByTag[newTag] : undefined
      ),
    });
    setMaxSpeedChanged(false);
  };

  const handleCloseStatusMessage = (key: 'mass' | 'length' | 'speed') => {
    setStatusMessagesVisible((prevState) => ({ ...prevState, [key]: false }));
  };

  // Propagate consist errors to parent component
  useEffect(() => {
    onConsistErrorsChange(consistErrors);
  }, [consistErrors]);

  return (
    <>
      <ConsistCardTitle rollingStock={rollingStock} />
      <StdcmCard
        name={t('consist.consist')}
        title={
          isConsistChange ? (
            <div
              data-testid="stdcm-via-delete-consist-change"
              className="stdcm-via-delete-consist-change"
            >
              <button
                data-testid="delete-consist-change-button"
                type="button"
                onClick={onDeleteConsistChange}
              >
                {t('translation:common.delete')}
              </button>
            </div>
          ) : undefined
        }
        disabled={disabled}
        className="consist"
        testId="consist"
      >
        <div className="traction-engine">
          <ComboBox
            testIdPrefix="traction-engine"
            id="tractionEngine"
            label={t('consist.tractionEngine')}
            value={rollingStock}
            getSuggestionLabel={getLabel}
            onSelectSuggestion={handleRollingStockSelect}
            {...rollingStockComboBoxDefaultProps}
            autoComplete="off"
            disabled={disabled}
            narrow
          />
        </div>
        <div className="towed-rolling-stock">
          <ComboBox
            testIdPrefix="towed-rolling-stock"
            id="towedRollingStock"
            label={t('consist.towedRollingStock')}
            value={towedRollingStock}
            getSuggestionLabel={(suggestion: TowedRollingStock) => suggestion.name}
            onSelectSuggestion={(towed) => {
              prefillConsist(rollingStock, towed, consist.speedLimitByTag, {
                towedRollingStockID: towed?.id,
              });
            }}
            {...towedRollingStockComboBoxDefaultProps}
            autoComplete="off"
            disabled={disabled}
            narrow
          />
        </div>
        {!isConsistChange && (
          <div className="loading-gauge">
            {loadingGauges && loadingGauges.length > 0 && (
              <Select
                id="loading-gauge-selector"
                value={consist.loadingGauge}
                label={t('consist.loadingGauge')}
                onChange={(e) => {
                  if (isLoadingGaugeType(e)) {
                    onLoadingGaugeChange(e);
                  } else {
                    onLoadingGaugeChange(undefined);
                  }
                }}
                {...createStandardSelectOptions(loadingGauges)}
                disabled={disabled}
                narrow
              />
            )}
          </div>
        )}
        <div className="stdcm-consist__properties">
          <Input
            testIdPrefix="tonnage"
            id="tonnage"
            label={t('consist.tonnage')}
            trailingContent="t"
            type="number"
            min={0}
            value={consist.totalMass ?? ''}
            onChange={(e) => {
              onTotalMassChange(e);
            }}
            onBlur={() => updateConsistErrors({ totalMass: totalMassError })}
            disabled={disabled}
            statusWithMessage={massFieldStatus}
            onCloseStatusMessage={() => handleCloseStatusMessage('mass')}
            narrow
          />
          <Input
            testIdPrefix="length"
            id="length"
            label={t('consist.length')}
            trailingContent="m"
            type="number"
            min={0}
            value={consist.totalLength ?? ''}
            onChange={(e) => {
              onTotalLengthChange(e);
            }}
            onBlur={() => updateConsistErrors({ totalLength: totalLengthError })}
            disabled={disabled}
            statusWithMessage={lengthFieldStatus}
            onCloseStatusMessage={() => handleCloseStatusMessage('length')}
            narrow
          />
        </div>
        <div className="stdcm-consist__properties">
          {!isConsistChange && (
            <>
              <SpeedLimitTagSelector
                disabled={disabled}
                selectedSpeedLimitTag={consist.speedLimitByTag}
                speedLimitTags={speedLimitTags}
                updateSpeedLimitTag={onSpeedLimitTagChange}
                showPlaceHolder={isDebugMode}
                narrow
              />
              <Input
                testIdPrefix="maxSpeed"
                id="maxSpeed"
                label={t('consist.maxSpeed')}
                trailingContent="km/h"
                type="number"
                min={0}
                value={consist.maxSpeed ?? ''}
                onChange={(e) => {
                  onMaxSpeedChange(e);
                }}
                onBlur={() => updateConsistErrors({ maxSpeed: maxSpeedError })}
                disabled={disabled}
                statusWithMessage={speedFieldStatus}
                onCloseStatusMessage={() => handleCloseStatusMessage('speed')}
                narrow
              />
            </>
          )}
        </div>
      </StdcmCard>
    </>
  );
};

export default StdcmConsist;
