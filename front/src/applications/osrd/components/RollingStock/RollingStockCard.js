import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { updateRollingStockID } from 'reducers/osrdconf';
import { useDispatch } from 'react-redux';
import ProgressSNCF from 'common/BootstrapSNCF/ProgressSNCF';
import RollingStockCurve from 'applications/osrd/components/RollingStock/RollingStockCurve';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import { IoIosSpeedometer } from 'react-icons/io';
import { FaWeightHanging } from 'react-icons/fa';
import { AiOutlineColumnWidth } from 'react-icons/ai';
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
                    <td className="text-primary">{t('startupTime')}</td>
                    <td>
                      {data.startup_time}
                      <span className="small text-muted ml-1">s</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-primary">{t('startupAcceleration')}</td>
                    <td>
                      {data.startup_acceleration}
                      <span className="small text-muted ml-1">m/s²</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-primary">{t('comfortAcceleration')}</td>
                    <td>
                      {data.comfort_acceleration}
                      <span className="small text-muted ml-1">m/s²</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-primary">{t('intertiaCoefficient')}</td>
                    <td>
                      {data.inertia_coefficient}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-primary">{t('timetableGamma')}</td>
                    <td>
                      {data.timetable_gamma * -1}
                      <span className="small text-muted ml-1">m/s²</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="col-sm-6">
              {data.power_class && data.power_class < 7 ? (
                <>
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
                  <ProgressSNCF
                    value={Math.floor(data.power_class * 16.67)}
                    small
                  />
                </>
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
                <div className="text-muted small">{t('rollingResistanceFormula')}</div>
              </div>
              <table className="rollingstock-details-table ml-2">
                <tbody>
                  <tr>
                    <td className="text-primary">a</td>
                    <td>
                      {Math.floor(data.rolling_resistance.A * 10000) / 10000}
                      <span className="small ml-1 text-muted">N</span>
                    </td>
                    <td className="text-primary">{t('rollingResistanceA')}</td>
                  </tr>
                  <tr>
                    <td className="text-primary">b</td>
                    <td>
                      {Math.floor(data.rolling_resistance.B * 10000) / 10000}
                      <span className="small ml-1 text-muted">N/(m/s)</span>
                    </td>
                    <td className="text-primary">{t('rollingResistanceB')}</td>
                  </tr>
                  <tr>
                    <td className="text-primary">c</td>
                    <td>
                      {Math.floor(data.rolling_resistance.C * 10000) / 10000}
                      <span className="small ml-1 text-muted">N/(m/s²)</span>
                    </td>
                    <td className="text-primary">{t('rollingResistanceC')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              <div className="curve-container">
                <RollingStockCurve data={data.tractive_effort_curves} />
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
