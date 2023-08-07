import React from 'react';

import SelectSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { cloneDeep } from 'lodash';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { IntervalItem } from './types';

type IntervalsEditorMarginFormProps = {
  data: IntervalItem[];
  defaultUnit?: string;
  fieldLabel?: string;
  interval: IntervalItem;
  selectedIntervalIndex: number;
  setData: (newData: IntervalItem[]) => void;
  units: string[];
};

const IntervalsEditorMarginForm = ({
  data,
  defaultUnit,
  fieldLabel,
  interval,
  selectedIntervalIndex,
  setData,
  units,
}: IntervalsEditorMarginFormProps) => (
  <div>
    <InputSNCF
      type="number"
      id="item-valueField"
      label={fieldLabel}
      onChange={(e) => {
        const result = cloneDeep(data);
        if (result && result[selectedIntervalIndex]) {
          result[selectedIntervalIndex].value = parseFloat(e.target.value);
          setData(result as IntervalItem[]);
        }
      }}
      value={(interval.value as number) || 0}
      noMargin
      sm
      isFlex
    />
    {units.length > 1 && (
      <div className="flexValuesEditionSelect">
        <SelectSNCF
          options={units}
          onChange={(newUnit) => {
            const result = cloneDeep(data);
            result[selectedIntervalIndex].unit = newUnit;
            setData(result as IntervalItem[]);
          }}
          sm
          selectedValue={(interval.unit as string) || defaultUnit || units[0]}
        />
      </div>
    )}
  </div>
);

export default IntervalsEditorMarginForm;
