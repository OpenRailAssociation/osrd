import React, { useState } from 'react';
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
import { imageCompo, displayCompo } from 'applications/osrd/components/RollingStock/Helpers';
import { powerClasses } from 'applications/osrd/components/RollingStock/consts';

export default function RollingStockCard(props) {
  const dispatch = useDispatch();
  const [detailDisplay, setDetailDisplay] = useState(false);
  const { data } = props;
  const { t } = useTranslation(['rollingstock']);

  const dummyTractionValues = ['NA', 'D'];
  let modetraction;

  const toggleDetailDisplay = () => {
    setDetailDisplay(!detailDisplay);
  };

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
      className="rollingstock-container mb-3"
      role="button"
      onClick={toggleDetailDisplay}
      tabIndex={0}
    >
      <div className="rollingstock-header">
        <div className="rollingstock-title">
          <div>{data.name}</div>
          <div>
            <small className="text-primary mr-1">ID</small>
            <span className="font-weight-lighter small">{data.id}</span>
          </div>
        </div>
      </div>
      {detailDisplay ? (
        <div className="rollingstock-body">
          <div className="row pt-2">
            <div className="col-sm-6">
              <table className="rollingstock-details-table">
                <tbody>
                  <tr>
                    <td>{t('startupTime')}</td>
                    <td>{data.startup_time}</td>
                  </tr>
                  <tr>
                    <td>{t('startupAcceleration')}</td>
                    <td>{data.startup_acceleration}</td>
                  </tr>
                  <tr>
                    <td>{t('comfortAcceleration')}</td>
                    <td>{data.comfort_acceleration}</td>
                  </tr>
                  <tr>
                    <td>{t('intertiaCoefficient')}</td>
                    <td>{data.inertia_coefficient}</td>
                  </tr>
                  <tr>
                    <td>{t('timetableGamma')}</td>
                    <td>{data.timetable_gamma}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="col-sm-6">
              {data.power_class ? (/* 1-5 max, must be adjusted for progress bar to 0-100% */
                <div>
                  <small className="mr-1 text-primary">
                    {t('powerClass')}
                  </small>
                  {data.power_class}
                  <span>: </span>
                  {powerClasses[data.power_class].a}
                  <span>A / </span>
                  {powerClasses[data.power_class].kw}
                  <small>kW</small>
                </div>
              ) : null}
              {data.capabilities.length > 0 ? (
                <div>
                  {t('capabilities')}
                  <span className="ml-1">
                    {data.capabilities.join(', ')}
                  </span>
                </div>
              ) : null}
              <div className="pt-1">
                {t('rollingResistance')}
                <span className="mx-1">:</span>
                {data.rolling_resistance.type}
              </div>
              <div className="ml-2">
                <small className="text-primary mr-1">
                  A (
                  {t('rollingResistanceA')}
                  )
                </small>
                {data.rolling_resistance.A}
              </div>
              <div className="ml-2">
                <small className="text-primary mr-1">
                  B (
                  {t('rollingResistanceB')}
                  )
                </small>
                {data.rolling_resistance.B}
              </div>
              <div className="ml-2">
                <small className="text-primary mr-1">
                  C (
                  {t('rollingResistanceC')}
                  )
                </small>
                {data.rolling_resistance.C}
              </div>
            </div>
          </div>
        </div>
      ) : null }
      <div className="rollingstock-footer py-2">
        <div className="rollingstock-tractionmode" style={{ display: 'none' }}>
          {modetraction}
        </div>
        <div className="rollingstock-size">
          <AiOutlineColumnWidth />
          {data.length}
          <small>M</small>
        </div>
        <div className="rollingstock-weight">
          <FaWeightHanging />
          {Math.round(data.mass / 1000)}
          <small>T</small>
        </div>
        <div className="rollingstock-speed">
          <IoIosSpeedometer />
          {Math.round(data.max_speed * 3.6)}
          <small>KM/H</small>
        </div>
        {detailDisplay ? (
          <button
            className="btn btn-primary btn-sm"
            type="button"
            data-dismiss="modal"
            onClick={() => dispatch(updateRollingStockID(data.id))}
          >
            {t('selectRollingStock')}
          </button>
        ) : null }
      </div>
    </div>
  );
}

RollingStockCard.propTypes = {
  data: PropTypes.object.isRequired,
};
