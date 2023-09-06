import React from 'react';
import { cloneDeep, head } from 'lodash';

import SelectSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { IntervalItem } from './types';

type IntervalsEditorMarginFormProps = {
  data: IntervalItem[];
  defaultUnit?: string;
  fieldLabel?: string;
  interval: IntervalItem;
  selectedIntervalIndex: number;
  setData: (newData: IntervalItem[]) => void;
  units?: string[];
};

const IntervalsEditorMarginForm = ({
  data,
  defaultUnit,
  fieldLabel,
  interval,
  selectedIntervalIndex,
  setData,
  units = [],
}: IntervalsEditorMarginFormProps) => (
  <div className="intervals-editor-form-column">
    <div className="intervals-editor-form-input">
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
      />
    </div>

    {units.length > 1 && (
      <SelectSNCF
        sm
        options={units}
        onChange={(newUnit) => {
          const result = cloneDeep(data);
          result[selectedIntervalIndex].unit = newUnit;
          setData(result);
        }}
        value={interval.unit || defaultUnit || head(units)}
      />
    )}
  </div>
);

export default IntervalsEditorMarginForm;
