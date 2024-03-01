import React from 'react';

import { cloneDeep } from 'lodash';

import SelectSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';

import type { IntervalItem } from './types';

type IntervalsEditorSelectFormProps = {
  data: IntervalItem[];
  interval: IntervalItem;
  selectedIntervalIndex: number;
  setData: (newData: IntervalItem[]) => void;
  selectOptions: string[];
};

const IntervalsEditorSelectForm = ({
  data,
  interval,
  selectedIntervalIndex,
  setData,
  selectOptions,
}: IntervalsEditorSelectFormProps) => (
  <div className="intervals-editor-select-form">
    <SelectSNCF
      sm
      value={`${interval.value}`}
      options={selectOptions}
      onChange={(newValue) => {
        if (newValue) {
          const result = cloneDeep(data);
          if (result[selectedIntervalIndex]) {
            result[selectedIntervalIndex].value = newValue;
            setData(result);
          }
        }
      }}
    />
  </div>
);

export default IntervalsEditorSelectForm;
