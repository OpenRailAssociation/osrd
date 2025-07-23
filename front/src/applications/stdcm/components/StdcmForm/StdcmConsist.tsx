import { useEffect, useMemo, useState } from 'react';

import { Input, ComboBox, useDefaultComboBox, Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { consistErrorFields } from 'applications/stdcm/consts';
import useConsistFieldStatus from 'applications/stdcm/hooks/useConsistFieldStatus';
import useFilterTowedRollingStock from 'applications/stdcm/hooks/useFilterTowedRollingStock';
import useStdcmTowedRollingStock from 'applications/stdcm/hooks/useStdcmTowedRollingStock';
import type { ConsistErrors } from 'applications/stdcm/types';
import calculateConsistMaxSpeed from 'applications/stdcm/utils/calculateConsistMaxSpeed';
import {
  validateMaxSpeed,
  validateTotalLength,
  validateTotalMass,
} from 'applications/stdcm/utils/consistValidation';
import type {
  LightRollingStockWithLiveries,
  LoadingGaugeType,
  TowedRollingStock,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import { updateMaxSpeed, updateTowedRollingStockID } from 'reducers/osrdconf/stdcmConf';
import {
  getStdcmRollingStockID,
  getStdcmSpeedLimitByTag,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';
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
  consistErrors: ConsistErrors;
  setConsistErrors: React.Dispatch<React.SetStateAction<ConsistErrors>>;
};

const GAUGE_LIST: LoadingGaugeType[] = ['GA', 'GB'];

const StdcmConsist = ({
  isDebugMode,
  disabled = false,
  consistErrors,
  setConsistErrors,
}: StdcmConsistProps) => {
  const { t } = useTranslation('stdcm');

  const speedLimitByTag = useSelector(getStdcmSpeedLimitByTag);
  const { speedLimitsByTags, dispatchUpdateSpeedLimitByTag } =
    useStoreDataForSpeedLimitByTagSelector({ isStdcm: true, speedLimitByTag });

  const { updateRollingStockID } = useOsrdConfActions();
  const dispatch = useAppDispatch();

  const rollingStockId = useSelector(getStdcmRollingStockID);
  const { rollingStock } = useStoreDataForRollingStockSelector({ rollingStockId });
  const towedRollingStock = useStdcmTowedRollingStock();

  const [statusMessagesVisible, setStatusMessagesVisible] = useState({
    mass: true,
    length: true,
    speed: true,
  });

  const {
    totalMass,
    onTotalMassChange,
    totalLength,
    onTotalLengthChange,
    maxSpeed,
    onMaxSpeedChange,
    loadingGauge,
    onLoadingGaugeChange,
    prefillConsist,
    statusWithMessage,
    setMaxSpeedChanged,
    speedLimitTags,
  } = useStdcmConsist();

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

  const getMissingFieldMessage = (value?: number): string | null => {
    if (!value) {
      return t('consist.errors.missingValue');
    }
    return null;
  };

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
    prefillConsist(option, towedRollingStock, speedLimitByTag);
    dispatch(updateRollingStockID(option?.id));
    setStatusMessagesVisible({
      mass: true,
      length: true,
      speed: true,
    });
  };

  const onSpeedLimitByTagChange = (newTag: string | null) => {
    dispatch(
      updateMaxSpeed(
        calculateConsistMaxSpeed(
          rollingStock,
          towedRollingStock,
          newTag ? (speedLimitTags || {})[newTag] : undefined
        )
      )
    );
    dispatchUpdateSpeedLimitByTag(newTag);
    setMaxSpeedChanged(false);
  };

  const handleCloseStatusMessage = (key: 'mass' | 'length' | 'speed') => {
    setStatusMessagesVisible((prevState) => ({ ...prevState, [key]: false }));
  };

  const handleBlurError = (field: keyof ConsistErrors, error?: string) => {
    setConsistErrors((prev) => ({
      ...prev,
      [field]: {
        message: error,
        display: !!error,
        type: error === t('consist.errors.missingValue') ? 'missing' : 'invalid',
      },
    }));
  };

  const totalMassError = useMemo(
    () =>
      getMissingFieldMessage(totalMass) ??
      validateTotalMass({
        tractionEngineMass: rollingStock?.mass,
        towedMass: towedRollingStock?.mass,
        totalMass,
      }),
    [totalMass]
  );

  const totalLengthError = useMemo(
    () =>
      getMissingFieldMessage(totalLength) ??
      validateTotalLength({
        tractionEngineLength: rollingStock?.length,
        towedLength: towedRollingStock?.length,
        totalLength,
      }),
    [totalLength]
  );

  const maxSpeedError = useMemo(
    () => getMissingFieldMessage(maxSpeed) ?? validateMaxSpeed(maxSpeed, rollingStock?.max_speed),
    [maxSpeed]
  );

  useEffect(() => {
    const errors = {
      totalMass: totalMassError,
      totalLength: totalLengthError,
      maxSpeed: maxSpeedError,
    };

    consistErrorFields.forEach((field) => {
      setConsistErrors((prev) => ({
        ...prev,
        [field]: {
          ...prev[field],
          display:
            prev[field].display &&
            (prev[field].type === 'missing'
              ? // Hide tooltip if the error was a missing one and is fixed regardless if the fied is still invalid
                !!(errors[field] === t('consist.errors.missingValue'))
              : !!errors[field]),
        },
      }));
    });
  }, [totalMassError, totalLengthError, maxSpeedError]);

  return (
    <StdcmCard
      name={t('consist.consist')}
      title={<ConsistCardTitle rollingStock={rollingStock} />}
      disabled={disabled}
      className="consist"
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
            prefillConsist(rollingStock, towed, speedLimitByTag);
            dispatch(updateTowedRollingStockID(towed?.id));
          }}
          {...towedRollingStockComboBoxDefaultProps}
          autoComplete="off"
          disabled={disabled}
          narrow
        />
      </div>
      <div className="loading-gauge">
        <Select
          id="loading-gauge-selector"
          value={loadingGauge}
          label={t('consist.loadingGauge')}
          onChange={(e) => {
            if (e) {
              onLoadingGaugeChange(e);
            }
          }}
          {...createStandardSelectOptions(GAUGE_LIST)}
          disabled={disabled}
          narrow
        />
      </div>
      <div className="stdcm-consist__properties">
        <Input
          testIdPrefix="tonnage"
          id="tonnage"
          label={t('consist.tonnage')}
          trailingContent="t"
          type="number"
          min={0}
          value={totalMass ?? ''}
          onChange={(e) => {
            onTotalMassChange(e);
          }}
          onBlur={() => handleBlurError('totalMass', totalMassError)}
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
          value={totalLength ?? ''}
          onChange={(e) => {
            onTotalLengthChange(e);
          }}
          onBlur={() => handleBlurError('totalLength', totalLengthError)}
          disabled={disabled}
          statusWithMessage={lengthFieldStatus}
          onCloseStatusMessage={() => handleCloseStatusMessage('length')}
          narrow
        />
      </div>
      <div className="stdcm-consist__properties">
        <SpeedLimitByTagSelector
          disabled={disabled}
          selectedSpeedLimitByTag={speedLimitByTag}
          speedLimitsByTags={speedLimitsByTags}
          dispatchUpdateSpeedLimitByTag={onSpeedLimitByTagChange}
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
          value={maxSpeed ?? ''}
          onChange={(e) => {
            onMaxSpeedChange(e);
          }}
          onBlur={() => handleBlurError('maxSpeed', maxSpeedError)}
          disabled={disabled}
          statusWithMessage={speedFieldStatus}
          onCloseStatusMessage={() => handleCloseStatusMessage('speed')}
          narrow
        />
      </div>
    </StdcmCard>
  );
};

export default StdcmConsist;
