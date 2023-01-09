import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { seconds2hhmmss } from 'applications/opendata/components/OpenDataHelpers';
import RollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';
import rollingstockOpenData2OSRD from './rollingstock_opendata2osrd.json';

export default function TrainDetail(props) {
  const { trainData, idx } = props;
  const [isOpened, setIsOpened] = useState(false);
  return (
    <div
      className="opendata-traindetail"
      role="button"
      tabIndex={0}
      onClick={() => setIsOpened(!isOpened)}
    >
      <div className="opendata-traindetail-main">
        <span className="opendata-traindetail-idx">{idx + 1}</span>
        <span className="opendata-traindetail-num">
          {trainData.num}
          <span className="opendata-traindetail-activity">{trainData.origine}</span>
        </span>
        <span className="opendata-traindetail-startend">
          {trainData.debut} - {trainData.fin}
        </span>
        <span className="opendata-traindetail-duration">{seconds2hhmmss(trainData.duree)}</span>
        <span className="opendata-traindetail-rollingstock">
          <span className="opendata-traindetail-rollingstock-img">
            <RollingStock2Img name={rollingstockOpenData2OSRD[trainData.type_em]} />
          </span>
        </span>
        <span className="opendata-traindetail-transilien">{trainData.num_transilien}</span>
        <span
          className={`opendata-traindetail-stepnb ${
            trainData.etapes.length <= 2 ? 'bg-secondary' : 'bg-primary'
          }`}
        >
          {trainData.etapes.length - 2}
        </span>
      </div>
      <div className={`opendata-traindetail-steps ${isOpened ? 'opened' : ''}`}>
        {trainData.etapes.map((step, stepIdx) =>
          // Remove origin & destination
          stepIdx !== 0 && stepIdx !== trainData.etapes.length - 1 ? (
            <div className="opendata-traindetail-step" key={nextId()}>
              <span className="opendata-traindetail-step-nb">{stepIdx}</span>
              <span className="opendata-traindetail-step-startend">
                {`${step.debut} - ${step.fin}`}
              </span>
              <span className="opendata-traindetail-step-duration">{step.duree}s</span>
              <span className="opendata-traindetail-step-name">{step.gare}</span>
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
