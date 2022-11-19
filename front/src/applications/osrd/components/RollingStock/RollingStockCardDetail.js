import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';
import { updateRollingStockID } from 'reducers/osrdconf';
import { useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { IoMdSunny, IoIosSnow } from 'react-icons/io';
import Loader from 'common/Loader';
import RollingStockCardButtons from './RollingStockCardButtons';
import RollingStockCurves from './RollingStockCurves';
import RollingStock2Img from './RollingStock2Img';

const ROLLING_STOCK_URL = '/rolling_stock/';

export default function RollingStockCardDetail(props) {
  const dispatch = useDispatch();
  const { id } = props;
  const [data, setData] = useState();
  const [displayDefaultCurve, setDisplayDefaultCurve] = useState(true);
  const { t } = useTranslation(['rollingstock']);

  const mode2name = (mode) => (mode !== 'thermal' ? `${mode}V` : t('thermal'));

  const countCurves = (curvesData) => {
    let nbCurves = 0;
    Object.keys(curvesData.modes).forEach((mode) => {
      curvesData.modes[mode].curves.forEach(() => {
        nbCurves += 1;
      });
    });
    return nbCurves;
  };

  const transformCurves = (curvesData) => {
    const transformedCurves = {};
    if (!displayDefaultCurve) {
      Object.keys(curvesData.modes).forEach((mode) => {
        curvesData.modes[mode].curves.forEach((curve) => {
          const name = mode2name(mode);
          const serieId = `${name} ${curve.cond.comfort}`;
          transformedCurves[serieId] = { ...curve.curve, mode: name, comfort: curve.cond.comfort };
        });
      });
      return transformedCurves;
    }
    return {
      default: {
        ...curvesData.modes[curvesData.default_mode].default_curve,
        mode: mode2name(curvesData.default_mode),
        comfort: null,
      },
    };
  };

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
          <div className="">
            <span className="font-weight-bold text-primary mr-3">{t('legend')}</span>
            <span className="mr-2">
              <span className="text-yellow mr-1">
                <IoMdSunny />
              </span>
              {t('comfortTypes.heating')}
            </span>
            <span>
              <span className="text-blue mr-1">
                <IoIosSnow />
              </span>
              {t('comfortTypes.ac')}
            </span>
          </div>
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
      <RollingStockCurves
        data={transformCurves(data.effort_curves)}
        displayDefaultCurve={displayDefaultCurve}
        nbCurves={countCurves(data.effort_curves)}
        setDisplayDefaultCurve={setDisplayDefaultCurve}
      />
      <div className="rollingstock-detail-container-img">
        <div className="rollingstock-detail-img">
          <RollingStock2Img name={data.name} />
        </div>
      </div>
      <RollingStockCardButtons />
    </div>
  ) : (
    <div className="rollingstock-body">
      <Loader />
    </div>
  );
}

RollingStockCardDetail.propTypes = {
  id: PropTypes.number.isRequired,
};
