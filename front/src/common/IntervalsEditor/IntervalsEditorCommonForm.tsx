import React from 'react';
import { useTranslation } from 'react-i18next';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { fixLinearMetadataItems, resizeSegment } from 'common/IntervalsDataViz/data';
import { notEmpty } from 'common/IntervalsDataViz/utils';
import { IntervalItem } from './types';

type IntervalsEditorFormProps = {
  data: IntervalItem[];
  interval: IntervalItem;
  selectedIntervalIndex: number;
  setData: (newData: IntervalItem[]) => void;
  totalLength: number;
};

const IntervalsEditorCommonForm = ({
  data,
  interval,
  selectedIntervalIndex,
  setData,
  totalLength,
}: IntervalsEditorFormProps) => {
  const { t } = useTranslation('common/common');

  /**
   * Resize segment from inputs
   */
  // TODO: fix bug
  const resizeSegmentByInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    context: 'begin' | 'end'
  ) => {
    const gap = parseFloat(e.target.value) - interval[context];
    const { result } = resizeSegment(data, selectedIntervalIndex, gap, context, false);
    const fixedResults = fixLinearMetadataItems(result.filter(notEmpty), totalLength);
    setData(fixedResults);
  };

  return (
    <div>
      <InputSNCF
        type="number"
        id="item-begin"
        label={t('begin')}
        onChange={(e) => {
          resizeSegmentByInput(e, 'begin');
        }}
        max={interval.end}
        value={interval.begin}
        isFlex
        noMargin
        sm
      />
      <InputSNCF
        type="number"
        id="item-end"
        label={t('end')}
        onChange={(e) => {
          resizeSegmentByInput(e, 'end');
        }}
        min={interval.begin}
        value={interval.end}
        isFlex
        noMargin
        sm
      />
    </div>
  );
};

export default React.memo(IntervalsEditorCommonForm);
