import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { updateRollingStockID } from 'reducers/osrdconf';
import { useDispatch } from 'react-redux';
import ProgressSNCF from 'common/BootstrapSNCF/ProgressSNCF';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import { IoIosSpeedometer } from 'react-icons/io';
import { FaWeightHanging } from 'react-icons/fa';
import { AiOutlineColumnWidth } from 'react-icons/ai';
import { imageCompo, displayCompo } from 'applications/osrd/components/TrainCompo/Helpers';

const genImagesCompo = (data) => {
  if (data.imageIDX >= 0) { // For chosen compo in osrdconf
    return displayCompo(data.imagesCompo);
  }
  if (data.first_image !== undefined) {
    const gifCompo = imageCompo(data);
    if (gifCompo[0] !== undefined) {
      return displayCompo(gifCompo[0].image);
    }
  }
  return '';
};

export default function TrainCompoCard(props) {
  const dispatch = useDispatch();
  const {
    data,
    displayDetails,
    active,
  } = props;
  const { t } = useTranslation();

  const dummyTractionValues = ['NA', 'D'];
  let modetraction;

  switch (data.modetraction) {
    case 'E':
    case 'Bicourant':
    case 'Tricourant':
    case 'Quadricourant':
      modetraction = (
        <>
          <span className="text-primary"><BsLightningFill /></span>
          {data.tensionutilisation}
        </>
      );
      break;
    case 'D':
      modetraction = <span className="text-pink"><MdLocalGasStation /></span>;
      break;
    case 'BiBi':
    case 'Bimode':
      modetraction = (
        <>
          <span className="text-pink"><MdLocalGasStation /></span>
          <span className="text-primary"><BsLightningFill /></span>
          {dummyTractionValues.includes(data.tensionutilisation) ? '' : data.tensionutilisation}
        </>
      );
      break;
    default:
      modetraction = data.modetraction;
      break;
  }

  return (
    <div
      className={`traincompo-container mb-3 ${active ? 'active' : ''}`}
      onClick={() => dispatch(updateRollingStockID(data.id))}
      role="button"
      tabIndex={0}
      data-dismiss="modal"
    >
      <div className="traincompo-header">
        <div className="traincompo-title">{data.name}</div>
        <div className="traincompo-img">
          <div className="traincompo-img-scale">
            {genImagesCompo(data)}
          </div>
        </div>
      </div>
      <div className="traincompo-body">
        <div className="row">
          <div className="col-sm-8">
            <div className="traincompo-subtitle">
              <small className="text-primary mr-1">ID</small>
              {data.id}
            </div>
          </div>
          <div className="col-sm-4">
            { /* classpuissance is 1-9 max, must be adjusted for progress bar to 0-100% */ }
            <small className="text-primary mr-1">
              {t('osrd.trainCompo.powerClass')}
            </small>
            {data.classepuissance}
            <ProgressSNCF small value={data.classepuissance * 9} />
          </div>
        </div>
      </div>
      <div className="traincompo-footer">
        <div className="traincompo-tractionmode">
          {modetraction}
        </div>
        <div className="traincompo-size">
          <AiOutlineColumnWidth />
          {data.length}
          <small>M</small>
        </div>
        <div className="traincompo-weight">
          <FaWeightHanging />
          {data.mass}
          <small>T</small>
        </div>
        <div className="traincompo-speed">
          <IoIosSpeedometer />
          {Math.round(data.max_speed * 3.6)}
          <small>KM/H</small>
        </div>
      </div>
    </div>
  );
}

TrainCompoCard.propTypes = {
  displayDetails: PropTypes.func.isRequired,
  data: PropTypes.object.isRequired,
  active: PropTypes.bool.isRequired,
};
