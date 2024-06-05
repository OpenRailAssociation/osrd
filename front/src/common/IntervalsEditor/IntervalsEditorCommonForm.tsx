import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import DebouncedNumberInputSNCF from 'common/BootstrapSNCF/FormSNCF/DebouncedNumberInputSNCF';
import { fixLinearMetadataItems, resizeSegment } from 'common/IntervalsDataViz/data';
import { notEmpty } from 'common/IntervalsDataViz/utils';

import type { IntervalsEditorProps } from './IntervalsEditor';
import type { IntervalItem } from './types';

type IntervalsEditorFormProps = {
  data: IntervalItem[];
  interval: IntervalItem;
  selectedIntervalIndex: number;
  setData: (newData: IntervalItem[], selectedIntervalIndex?: number) => void;
  onInputChange?: IntervalsEditorProps['onResizeFromInput'];
  setSelectedIntervalIndex: (selectedIntervalIndex: number) => void;
  totalLength: number;
  defaultValue: string | number;
};

const IntervalsEditorCommonForm = ({
  data,
  interval,
  selectedIntervalIndex,
  setData,
  setSelectedIntervalIndex,
  totalLength,
  defaultValue,
  onInputChange,
}: IntervalsEditorFormProps) => {
  const { t } = useTranslation('common/common');

  const [begin, setBegin] = useState(Math.round(interval.begin));
  const [end, setEnd] = useState(Math.round(interval.end));

  useEffect(() => {
    setBegin(Math.round(interval.begin));
    setEnd(Math.round(interval.end));
  }, [interval]);

  const resizeSegmentByInput = (newPosition: number, context: 'begin' | 'end') => {
    const gap = newPosition - interval[context];

    // use absolute value to manage cases where the position is not rounded
    // ex: begin = 1200.68 and newPosition = 1200 (because input is rounded)
    if (Math.abs(gap) > 1) {
      const { result, newIndexMapping } = resizeSegment(
        data,
        selectedIntervalIndex,
        gap,
        context,
        false
      );
      const fixedResults = fixLinearMetadataItems(result.filter(notEmpty), totalLength, {
        fieldName: 'value',
        defaultValue,
      });
      if (onInputChange) {
        onInputChange(selectedIntervalIndex, context, newPosition);
      } else {
        setData(fixedResults, selectedIntervalIndex);
      }

      // update the selected interval if needed
      // corner case: if we create a new empty first segment
      if (
        fixedResults.length !== Object.keys(newIndexMapping).length &&
        selectedIntervalIndex === 0
      ) {
        setSelectedIntervalIndex(1);
      } else {
        const newIndex = newIndexMapping[selectedIntervalIndex];
        if (newIndex !== null && newIndex !== selectedIntervalIndex) {
          setSelectedIntervalIndex(newIndex);
        }
      }
    }
  };

  useEffect(() => resizeSegmentByInput(begin, 'begin'), [begin]);
  useEffect(() => resizeSegmentByInput(end, 'end'), [end]);

  return (
    <div className="intervals-editor-form-column">
      <DebouncedNumberInputSNCF
        id="item-begin-input"
        input={begin}
        label={t('begin')}
        setInput={setBegin}
        max={interval.end}
        sm
        showFlex
      />
      <DebouncedNumberInputSNCF
        id="item-end-input"
        input={end}
        label={t('end')}
        setInput={setEnd}
        min={interval.begin}
        max={Math.round(totalLength)}
        sm
        showFlex
      />
    </div>
  );
};

export default React.memo(IntervalsEditorCommonForm);
