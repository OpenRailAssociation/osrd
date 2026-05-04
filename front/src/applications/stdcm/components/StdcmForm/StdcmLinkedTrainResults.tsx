import { RadioButton } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { Loader } from 'common/Loaders';

import type { LinkedTrainType, StdcmLinkedTrainResult } from '../../types';

type StdcmLinkedTrainResultsProps = {
  linkedTrainType: LinkedTrainType;
  linkedTrainResults: StdcmLinkedTrainResult[] | undefined;
  selectLinkedTrain: (selectedIndex: number) => void;
  selectedLinkedTrainIndex: number | undefined;
  loading: boolean;
};

const StdcmLinkedTrainResults = ({
  linkedTrainType,
  linkedTrainResults,
  selectLinkedTrain,
  selectedLinkedTrainIndex,
  loading,
}: StdcmLinkedTrainResultsProps) => {
  const { t } = useTranslation('stdcm');

  if (loading) return <Loader />;

  if (!linkedTrainResults?.length)
    return <p className="text-center mb-0">{t('noCorrespondingResults')}</p>;

  return (
    <div className="stdcm-linked-train-results">
      {linkedTrainResults.map(({ trainName, origin, destination }, index) => (
        <button
          key={`linked-train-${index}`}
          tabIndex={0}
          type="button"
          className="linked-train-result-infos"
          data-testid="linked-train-result-infos"
          onClick={() => {
            selectLinkedTrain(index);
          }}
        >
          <RadioButton
            label={trainName}
            id={`${linkedTrainType}-${index}`}
            value={`${index}`}
            name={`linked-train-radio-buttons-${linkedTrainType}`}
            defaultChecked={index === selectedLinkedTrainIndex}
          />
          {[origin, destination].map((opPoint) => (
            <div
              key={`linked-op-${opPoint.obj_id}-${index}`}
              className={cx('d-flex', { 'ml-4 pl-1': linkedTrainResults.length > 1 })}
            >
              <p className="opDetails grey50">{opPoint.date}</p>
              <p className="opDetails info60">{opPoint.time}</p>
              <p className="opDetails grey80">{opPoint.name}</p>
              {'trigram' in opPoint && <p className="opDetails grey80">{opPoint.trigram}</p>}
            </div>
          ))}
        </button>
      ))}
    </div>
  );
};

export default StdcmLinkedTrainResults;
