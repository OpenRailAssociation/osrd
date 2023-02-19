import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { seconds2hhmmss } from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleHelpers';
import RollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';
import { LazyLoadComponent } from 'react-lazy-load-image-component';

export default function ImportTrainScheduleTrainDetail(props) {
  const { trainData, idx, rollingStock } = props;
  const [isOpened, setIsOpened] = useState(false);

  const openCard = () => {
    if (trainData.etapes.length > 2) {
      setIsOpened(!isOpened);
    }
  };

  return (
    <div
      className="import-train-schedule-traindetail import-train-schedule-traindetail-no-hover"
      role="button"
      tabIndex={0}
      onClick={openCard}
    >
      <div
        className={`import-train-schedule-traindetail-main ${
          trainData.etapes.length > 2 ? 'import-train-schedule-traindetail-with-hover' : null
        }`}
      >
        <span className="import-train-schedule-traindetail-idx">{idx + 1}</span>
        <span className="import-train-schedule-traindetail-num">
          {trainData.num}
          <span className="import-train-schedule-traindetail-activity">{trainData.origine}</span>
        </span>
        <span className="import-train-schedule-traindetail-startend">
          {trainData.debut} - {trainData.fin}
        </span>
        <span className="import-train-schedule-traindetail-duration">
          {seconds2hhmmss(trainData.duree)}
        </span>
        {rollingStock ? (
          <LazyLoadComponent>
            <span className="import-train-schedule-traindetail-rollingstock">
              <RollingStock2Img rollingStock={rollingStock} />
            </span>
          </LazyLoadComponent>
        ) : null}
        <span className="import-train-schedule-traindetail-transilien">
          {trainData.num_transilien}
        </span>
        <span
          className={`import-train-schedule-traindetail-stepnb ${
            trainData.etapes.length <= 2 ? 'bg-secondary' : 'bg-primary'
          }`}
        >
          {trainData.etapes.length - 2}
        </span>
      </div>
      <div className={`import-train-schedule-traindetail-steps ${isOpened ? 'opened' : ''}`}>
        {trainData.etapes.map((step, stepIdx) =>
          // Remove origin & destination
          stepIdx !== 0 && stepIdx !== trainData.etapes.length - 1 ? (
            <div className="import-train-schedule-traindetail-step" key={nextId()}>
              <span className="import-train-schedule-traindetail-step-nb">{stepIdx}</span>
              <span className="import-train-schedule-traindetail-step-startend">
                {`${step.debut} - ${step.fin}`}
              </span>
              <span className="import-train-schedule-traindetail-step-duration">{step.duree}s</span>
              <span className="import-train-schedule-traindetail-step-name">{step.gare}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

ImportTrainScheduleTrainDetail.propTypes = {
  trainData: PropTypes.object.isRequired,
  idx: PropTypes.number.isRequired,
  rollingStock: PropTypes.object.isRequired,
};
