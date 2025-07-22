import { RadioButton } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useDispatch } from 'react-redux';

import { updateLinkedTrainExtremity } from 'reducers/osrdconf/stdcmConf';

import type { StdcmLinkedTrainResult, ExtremityPathStepType } from '../../types';

type StdcmLinkedTrainResultsProps = {
  linkedTrainResults: StdcmLinkedTrainResult[];
  linkedOp: { extremityType: ExtremityPathStepType; id: string };
};

const StdcmLinkedTrainResults = ({
  linkedTrainResults,
  linkedOp: { extremityType, id },
}: StdcmLinkedTrainResultsProps) => {
  const dispatch = useDispatch();
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
            if (linkedTrainResults.length === 1)
              dispatch(
                updateLinkedTrainExtremity({
                  linkedTrainExtremity: extremityType,
                  trainName,
                  pathStep: linkedTrainResults[0][extremityType],
                  pathStepId: id,
                })
              );
          }}
        >
          {linkedTrainResults.length > 1 ? (
            <RadioButton
              label={trainName}
              id={`${extremityType}-${index}`}
              value={`${index}`}
              name={`linked-train-radio-buttons-${extremityType}`}
              onClick={({ target }) => {
                const resultIndex = Number((target as HTMLInputElement).value);
                dispatch(
                  updateLinkedTrainExtremity({
                    linkedTrainExtremity: extremityType,
                    trainName,
                    pathStep: linkedTrainResults[resultIndex][extremityType],
                    pathStepId: id,
                  })
                );
              }}
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
