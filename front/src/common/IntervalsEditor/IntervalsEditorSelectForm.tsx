import React from 'react';

import SelectSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { cloneDeep } from 'lodash';
import { IntervalItem } from './types';

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
  <div className="flexValuesEditionSelect">
    <SelectSNCF
      options={selectOptions}
      onChange={(newValue) => {
        const result = cloneDeep(data);
        if (result[selectedIntervalIndex]) {
          result[selectedIntervalIndex].value = newValue;
          setData(result);
        }
      }}
      sm
      selectedValue={(interval.value as string) || ''}
    />
  </div>
);

export default IntervalsEditorSelectForm;
