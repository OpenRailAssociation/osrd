import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';
import { useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import Loader from 'common/Loader';
import RollingStockCurves from './RollingStockCurves';
import RollingStock2Img from './RollingStock2Img';

const ROLLING_STOCK_URL = '/rolling_stock/';

export default function RollingStockCardDetail(props) {
  const dispatch = useDispatch();
  const { id, curvesComfortList, setCurvesComfortList } = props;
  const [data, setData] = useState();
  const [displayDefaultCurve, setDisplayDefaultCurve] = useState(true);
  const { t } = useTranslation(['rollingstock']);

  const mode2name = (mode) => (mode !== 'thermal' ? `${mode}V` : t('thermal'));

  const listCurvesComfort = (curvesData) => {
    const list = [];
    Object.keys(curvesData.modes).forEach((mode) => {
      curvesData.modes[mode].curves.forEach((curve) => {
        list.push(curve.cond.comfort);
      });
    });
    return list;
  };

  const transformCurves = (curvesData) => {
    const transformedCurves = {};
    transformedCurves.default = {
      ...curvesData.modes[curvesData.default_mode].default_curve,
      mode: mode2name(curvesData.default_mode),
      comfort: null,
    };
    if (!displayDefaultCurve) {
      Object.keys(curvesData.modes).forEach((mode) => {
        curvesData.modes[mode].curves.forEach((curve) => {
          const name = mode2name(mode);
          const serieId = `${name} ${curve.cond.comfort}`;
          transformedCurves[serieId] = { ...curve.curve, mode: name, comfort: curve.cond.comfort };
        });
      });
    }
    return transformedCurves;
  };

  const getRollingStock = async () => {
    try {
      const rollingStockData = await get(`${ROLLING_STOCK_URL + id}/`);
      setData(rollingStockData);
      setCurvesComfortList(listCurvesComfort(rollingStockData.effort_curves));
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
    if (id) {
      getRollingStock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return data ? (
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
              <tr>
                <td className="text-primary">{t('loadingGauge')}</td>
                <td>{data.loading_gauge}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="col-sm-6">
          {data.features && data.features.length > 0 ? (
            <div className="pb-1">
              {t('features')}
              <span className="ml-1">{data.features.join(', ')}</span>
            </div>
          ) : null}
          <div>
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
      <RollingStockCurves
        data={transformCurves(data.effort_curves)}
        displayDefaultCurve={displayDefaultCurve}
        curvesComfortList={curvesComfortList}
        setDisplayDefaultCurve={setDisplayDefaultCurve}
      />
      <div className="rollingstock-detail-container-img">
        <div className="rollingstock-detail-img">
          <RollingStock2Img name={data.name} />
        </div>
      </div>
    </div>
  ) : (
    <div className="rollingstock-body">
      <Loader />
    </div>
  );
}

RollingStockCardDetail.propTypes = {
  id: PropTypes.number.isRequired,
  curvesComfortList: PropTypes.number.isRequired,
  setCurvesComfortList: PropTypes.func.isRequired,
};
