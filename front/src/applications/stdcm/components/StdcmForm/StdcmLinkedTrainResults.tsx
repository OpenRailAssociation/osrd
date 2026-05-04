import { RadioButton } from '@osrd-project/ui-core';
import cx from 'classnames';

import type { LinkedTrainType, StdcmLinkedTrainResult } from '../../types';

type StdcmLinkedTrainResultsProps = {
  linkedTrainType: LinkedTrainType;
  linkedTrainResults: StdcmLinkedTrainResult[];
  selectLinkedTrain: (selectedIndex: number) => void;
  selectedLinkedTrainIndex: number | undefined;
};

const StdcmLinkedTrainResults = ({
  linkedTrainType,
  linkedTrainResults,
  selectLinkedTrain,
  selectedLinkedTrainIndex,
}: StdcmLinkedTrainResultsProps) => {
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
          {linkedTrainResults.length > 1 ? (
            <RadioButton
              label={trainName}
              id={`${linkedTrainType}-${index}`}
              value={`${index}`}
              name={`linked-train-radio-buttons-${linkedTrainType}`}
              defaultChecked={index === selectedLinkedTrainIndex}
            />
          ) : (
            <p className="train-name grey80">{trainName}</p>
          )}
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
