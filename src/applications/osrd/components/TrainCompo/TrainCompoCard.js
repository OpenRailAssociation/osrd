import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import ProgressSNCF from 'common/BootstrapSNCF/ProgressSNCF';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import { IoIosSpeedometer } from 'react-icons/io';
import { FaWeightHanging } from 'react-icons/fa';
import { AiOutlineColumnWidth } from 'react-icons/ai';
import { imageCompo, displayCompo } from 'applications/osrd/components/TrainCompo/Helpers';

class TrainCompoCard extends Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    displayDetails: PropTypes.func.isRequired,
    data: PropTypes.object.isRequired,
    active: PropTypes.bool.isRequired,
  }

  genImagesCompo = () => {
    const { data } = this.props;
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
  }

  render = () => {
    const {
      t,
      data,
      displayDetails,
      active,
    } = this.props;

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
        onClick={() => displayDetails(data.codenbengin)}
        role="button"
        tabIndex={0}
      >
        <div className="traincompo-header">
          <div className="traincompo-title">{data.enginref}</div>
          <div className="traincompo-img">
            <div className="traincompo-img-scale">
              {this.genImagesCompo()}
            </div>
          </div>
        </div>
        <div className="traincompo-body">
          <div className="row">
            <div className="col-sm-8">
              <div className="traincompo-subtitle">
                {data.materielanalyse}
                <br />
                <small className="text-primary mr-1">ID</small>
                {data.codeengin}
                <small className="text-primary ml-2 mr-1">SOURCE</small>
                <small className="text-muted">{data.source}</small>
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
            {data.longueurconvoi}
            <small>M</small>
          </div>
          <div className="traincompo-weight">
            <FaWeightHanging />
            {data.etatchargevom}
            <small>T</small>
          </div>
          <div className="traincompo-speed">
            <IoIosSpeedometer />
            {data.vitessmax}
            <small>KM/H</small>
          </div>
        </div>
      </div>
    );
  }
}

export default withTranslation()(TrainCompoCard);
