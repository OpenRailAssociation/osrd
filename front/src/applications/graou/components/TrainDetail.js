import React from 'react';
import PropTypes from 'prop-types';
import { seconds2hhmmss } from 'applications/graou/components/GraouHelpers';

export default function TrainDetail(props) {
  const { trainData, idx } = props;
  return (
    <div className="graou-traindetail">
      <span className="graou-traindetail-idx">{idx}</span>
      <span className="graou-traindetail-num">
        {trainData.num}
        <span className="graou-traindetail-activity">{trainData.origine}</span>
      </span>
      <span className="graou-traindetail-startend">
        {trainData.debut} - {trainData.fin}
      </span>
      <span className="graou-traindetail-duration">{seconds2hhmmss(trainData.duree)}</span>
      <span className="graou-traindetail-transilien">{trainData.num_transilien}</span>
      <span className="graou-traindetail-stepnb">{trainData.etapes.length}</span>
    </div>
  );
}

TrainDetail.propTypes = {
  trainData: PropTypes.object.isRequired,
  idx: PropTypes.number.isRequired,
};
