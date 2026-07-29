import { useCallback } from 'react';

import { ComboBox, useDefaultComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';

import type { TrainFieldsState } from './ExpandedTrainForm';

type RollingStockFieldProps = {
  rollingStocks: LightRollingStockWithLiveries[];
  value: LightRollingStockWithLiveries | string;
  onFieldImmediateChange: (
    fieldName: keyof TrainFieldsState,
    value: TrainFieldsState[typeof fieldName]
  ) => void;
};

export default function RollingStockField({
  rollingStocks,
  value,
  onFieldImmediateChange,
}: RollingStockFieldProps) {
  const { t } = useTranslation(['operational-studies', 'translation']);

  const getRollingStockLabel = useCallback((rs: LightRollingStockWithLiveries) => {
    const secondPart = rs.metadata?.series || rs.metadata?.reference || '';
    return secondPart ? `${rs.name} - ${secondPart}` : rs.name;
  }, []);

  const {
    suggestions: rollingStockSuggestions,
    onChange: onRollingStockQueryChange,
    resetSuggestions: resetRollingStockSuggestions,
  } = useDefaultComboBox(rollingStocks, getRollingStockLabel);

  return (
    <ComboBox
      id="train-header-rolling-stock"
      testIdPrefix="train-header-rolling-stock"
      label={t('manageTrainSchedule.trainHeader.form.rollingStock')}
      small
      autoComplete="off"
      value={typeof value === 'object' ? getRollingStockLabel(value) : value}
      suggestions={rollingStockSuggestions.map(getRollingStockLabel)}
      getSuggestionLabel={(s) => s}
      onSelectSuggestion={(label) => {
        const rs = rollingStocks.find((r) => getRollingStockLabel(r) === label);
        onFieldImmediateChange('rolling_stock', rs ?? label);
      }}
      resetSuggestions={resetRollingStockSuggestions}
      onChange={(e) => {
        onRollingStockQueryChange(e);
      }}
      onAddCustomValue={(label) => {
        onFieldImmediateChange('rolling_stock', label);
      }}
    />
  );
}
