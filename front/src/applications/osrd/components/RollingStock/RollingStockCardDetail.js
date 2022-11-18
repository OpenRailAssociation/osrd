import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';
import { updateRollingStockID } from 'reducers/osrdconf';
import { useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import RollingStockCurve from 'applications/osrd/components/RollingStock/RollingStockCurve';

const ROLLING_STOCK_URL = '/rolling_stock/';

export default function RollingStockCardDetail(props) {
  const dispatch = useDispatch();
  const { id, detailDisplay, setDetailDisplay } = props;
  const [data, setData] = useState();
  const { t } = useTranslation(['rollingstock']);

  const getRollingStock = async () => {
    try {
      const rollingStockData = await get(`${ROLLING_STOCK_URL + id}/`);
      setData(rollingStockData);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('osrdconf:errorMessages.unableToRetrieveRollingStock'),
          message: e.message,
        })
      );
      console.log(e);
    }
  };

  useEffect(() => {
    if (detailDisplay && id) {
      getRollingStock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailDisplay, id]);

  return detailDisplay && data ? (
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
                <td>{data.inertia_coefficient}</td>
              </tr>
              <tr>
                <td className="text-primary">{t('timetableGamma')}</td>
                <td>
                  {data.gamma.value * -1}
                  <span className="small text-muted ml-1">m/s²</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="col-sm-6">
          {data.features && data.features.length > 0 ? (
            <div>
              {t('features')}
              <span className="ml-1">{data.features.join(', ')}</span>
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
            {/* <RollingStockCurve data={data.effort_curve} /> */}
          </div>
        </div>
      </div>
    </div>
  ) : null;
}

/*
{detailDisplay ? (
  <button
    className="btn btn-primary btn-sm"
    type="button"
    data-dismiss="modal"
    onClick={() => dispatch(updateRollingStockID(data.id))}
  >
    {t('selectRollingStock')}
  </button>
) : null}
*/

RollingStockCardDetail.propTypes = {
  id: PropTypes.number.isRequired,
  detailDisplay: PropTypes.bool.isRequired,
  setDetailDisplay: PropTypes.func.isRequired,
};
