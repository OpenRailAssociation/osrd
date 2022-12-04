import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { seconds2hhmmss } from 'applications/graou/components/GraouHelpers';
import RollingStock2Img from 'applications/osrd/components/RollingStock/RollingStock2Img';
import rollingstockGraou2OSRD from './rollingstock_graou2osrd.json';

export default function TrainDetail(props) {
  const { trainData, idx } = props;
  const [isOpened, setIsOpened] = useState(false);
  return (
    <div
      className="graou-traindetail"
      role="button"
      tabIndex={0}
      onClick={() => setIsOpened(!isOpened)}
    >
      <div className="graou-traindetail-main">
        <span className="graou-traindetail-idx">{idx + 1}</span>
        <span className="graou-traindetail-num">
          {trainData.num}
          <span className="graou-traindetail-activity">{trainData.origine}</span>
        </span>
        <span className="graou-traindetail-startend">
          {trainData.debut} - {trainData.fin}
        </span>
        <span className="graou-traindetail-duration">{seconds2hhmmss(trainData.duree)}</span>
        <span className="graou-traindetail-rollingstock">
          <span className="graou-traindetail-rollingstock-img">
            <RollingStock2Img name={rollingstockGraou2OSRD[trainData.type_em]} />
          </span>
        </span>
        <span className="graou-traindetail-transilien">{trainData.num_transilien}</span>
        <span
          className={`graou-traindetail-stepnb ${
            trainData.etapes.length <= 2 ? 'bg-secondary' : 'bg-primary'
          }`}
        >
          {trainData.etapes.length - 2}
        </span>
      </div>
      <div className={`graou-traindetail-steps ${isOpened ? 'opened' : ''}`}>
        {trainData.etapes.map((step, stepIdx) =>
          // Remove origin & destination
          stepIdx !== 0 && stepIdx !== trainData.etapes.length - 1 ? (
            <div className="graou-traindetail-step" key={nextId()}>
              <span className="graou-traindetail-step-nb">{stepIdx}</span>
              <span className="graou-traindetail-step-startend">
                {`${step.debut} - ${step.fin}`}
              </span>
              <span className="graou-traindetail-step-duration">{step.duree}s</span>
              <span className="graou-traindetail-step-name">{step.gare}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

TrainDetail.propTypes = {
  trainData: PropTypes.object.isRequired,
  idx: PropTypes.number.isRequired,
};
