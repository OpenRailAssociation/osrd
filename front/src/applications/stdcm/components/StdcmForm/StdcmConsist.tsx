import { useEffect, useState } from 'react';

import { Input, ComboBox, useDefaultComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useConsistFieldStatus from 'applications/stdcm/hooks/useConsistFieldStatus';
import useStdcmTowedRollingStock from 'applications/stdcm/hooks/useStdcmTowedRollingStock';
import type { ConsistErrors } from 'applications/stdcm/types';
import calculateConsistMaxSpeed from 'applications/stdcm/utils/calculateConsistMaxSpeed';
import {
  validateMaxSpeed,
  validateTotalLength,
  validateTotalMass,
} from 'applications/stdcm/utils/consistValidation';
import type { LightRollingStockWithLiveries, TowedRollingStock } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import useFilterTowedRollingStock from 'modules/towedRollingStock/hooks/useFilterTowedRollingStock';
import { updateMaxSpeed, updateTowedRollingStockID } from 'reducers/osrdconf/stdcmConf';
import {
  getStdcmRollingStockID,
  getStdcmSpeedLimitByTag,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';

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
};

const StdcmConsist = ({ isDebugMode, disabled = false }: StdcmConsistProps) => {
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

  const [consistErrors, setConsistErrors] = useState<ConsistErrors>({
    totalMass: { display: false },
    totalLength: { display: false },
    maxSpeed: { display: false },
  });

  const {
    totalMass,
    onTotalMassChange,
    totalLength,
    onTotalLengthChange,
    maxSpeed,
    onMaxSpeedChange,
    prefillConsist,
    statusWithMessage,
    setMaxSpeedChanged,
  } = useStdcmConsist();

  const createFieldStatus = (field: 'totalMass' | 'totalLength' | 'maxSpeed') =>
    useConsistFieldStatus(
      field,
      statusWithMessage,
      consistErrors,
      statusMessagesVisible,
      rollingStock,
      towedRollingStock
    );

  const massFieldStatus = createFieldStatus('totalMass');
  const lengthFieldStatus = createFieldStatus('totalLength');
  const speedFieldStatus = createFieldStatus('maxSpeed');

  const { filteredRollingStockList: rollingStocks } = useFilterRollingStock({ isStdcm: true });

  const { filteredTowedRollingStockList: towedRollingStocks } = useFilterTowedRollingStock({
    isDebugMode,
  });

  const getLabel = (rs: LightRollingStockWithLiveries) => {
    const secondPart = rs.metadata?.series || rs.metadata?.reference || '';
    return secondPart ? `${rs.name} - ${secondPart}` : rs.name;
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const rollingStockComboBoxDefaultProps = useDefaultComboBox(rollingStocks, getLabel);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
    dispatch(updateMaxSpeed(calculateConsistMaxSpeed(rollingStock, towedRollingStock, newTag)));
    dispatchUpdateSpeedLimitByTag(newTag);
    setMaxSpeedChanged(false);
  };

  const handleCloseStatusMessage = (key: 'mass' | 'length' | 'speed') => {
    setStatusMessagesVisible((prevState) => ({ ...prevState, [key]: false }));
  };

  useEffect(() => {
    const totalMassError = validateTotalMass({
      tractionEngineMass: rollingStock?.mass,
      towedMass: towedRollingStock?.mass,
      totalMass,
    });

    const totalLengthError = validateTotalLength({
      tractionEngineLength: rollingStock?.length,
      towedLength: towedRollingStock?.length,
      totalLength,
    });

    const maxSpeedError = validateMaxSpeed(maxSpeed, rollingStock?.max_speed);

    // Hide the tooltip if the user just changed the value for an invalid one (should be displayed only on focus out)
    // but we also want to hide it as soon as the user corrects it
    setConsistErrors((prevErrors) => ({
      totalMass: {
        message: totalMassError,
        display: prevErrors.totalMass.display && !!totalMassError,
      },
      totalLength: {
        message: totalLengthError,
        display: prevErrors.totalLength.display && !!totalLengthError,
      },
      maxSpeed: {
        message: maxSpeedError,
        display: prevErrors.maxSpeed.display && !!maxSpeedError,
      },
    }));
  }, [rollingStock, towedRollingStock, totalMass, totalLength, maxSpeed]);

  return (
    <StdcmCard
      name={t('consist.consist')}
      title={<ConsistCardTitle rollingStock={rollingStock} />}
      disabled={disabled}
      className="consist"
    >
      <div className="traction-engine">
        <ComboBox
          id="tractionEngine"
          label={t('consist.tractionEngine')}
          value={rollingStock}
          getSuggestionLabel={getLabel}
          onSelectSuggestion={handleRollingStockSelect}
          {...rollingStockComboBoxDefaultProps}
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div className="towed-rolling-stock">
        <ComboBox
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
        />
      </div>
      <div className="stdcm-consist__properties">
        <Input
          id="tonnage"
          label={t('consist.tonnage')}
          trailingContent="t"
          type="number"
          min={0}
          value={totalMass ?? ''}
          onChange={onTotalMassChange}
          onBlur={() => {
            setConsistErrors({
              ...consistErrors,
              totalMass: { ...consistErrors.totalMass, display: !!consistErrors.totalMass.message },
            });
          }}
          disabled={disabled}
          statusWithMessage={massFieldStatus}
          onCloseStatusMessage={() => handleCloseStatusMessage('mass')}
        />
        <Input
          id="length"
          label={t('consist.length')}
          trailingContent="m"
          type="number"
          min={0}
          value={totalLength ?? ''}
          onChange={onTotalLengthChange}
          onBlur={() => {
            setConsistErrors({
              ...consistErrors,
              totalLength: {
                ...consistErrors.totalLength,
                display: !!consistErrors.totalLength.message,
              },
            });
          }}
          disabled={disabled}
          statusWithMessage={lengthFieldStatus}
          onCloseStatusMessage={() => handleCloseStatusMessage('length')}
        />
      </div>
      <div className="stdcm-consist__properties">
        <SpeedLimitByTagSelector
          disabled={disabled}
          selectedSpeedLimitByTag={speedLimitByTag}
          speedLimitsByTags={speedLimitsByTags}
          dispatchUpdateSpeedLimitByTag={onSpeedLimitByTagChange}
          showPlaceHolder={isDebugMode}
        />
        <Input
          id="maxSpeed"
          label={t('consist.maxSpeed')}
          trailingContent="km/h"
          type="number"
          min={0}
          value={maxSpeed ?? ''}
          onChange={onMaxSpeedChange}
          onBlur={() => {
            setConsistErrors({
              ...consistErrors,
              maxSpeed: { ...consistErrors.maxSpeed, display: !!consistErrors.maxSpeed.message },
            });
          }}
          disabled={disabled}
          statusWithMessage={speedFieldStatus}
          onCloseStatusMessage={() => handleCloseStatusMessage('speed')}
        />
      </div>
    </StdcmCard>
  );
};

export default StdcmConsist;
