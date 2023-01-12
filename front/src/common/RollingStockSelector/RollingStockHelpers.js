import React from 'react';
import PropTypes from 'prop-types';
import { IoIosSnow } from 'react-icons/io';
import { ImFire } from 'react-icons/im';
import rollingStockDetailDB from './consts/rollingstockDetailDB.json';

// To remove when details will be inside backend DB
export const enhanceData = (data) =>
  data.map((rollingstock) => ({
    ...rollingstock,
    ...rollingStockDetailDB[rollingstock.name],
  }));

export function checkUnit(data) {
  if (data.unit && data.unit !== 'US') {
    return <span className={`rollingstock-infos-unit ${data.unit}`}>{data.unit}</span>;
  }
  if (data.detail?.search(/UM3/i) !== -1) {
    return <span className="rollingstock-infos-unit UM3">UM3</span>;
  }
  if (data.detail.search(/UM|MUX/i) !== -1) {
    return <span className="rollingstock-infos-unit UM2">UM2</span>;
  }
  return null;
}

export function RollingStockInfos(props) {
  const { data, showSeries, showMiddle, showEnd } = props;
  const series = data.series ? (
    <span className="rollingstock-infos-begin">
      <span className="rollingstock-infos-series">{data.series}</span>
      {checkUnit(data)}
      <span className="rollingstock-infos-subseries">
        {data.series !== data.subseries ? data.subseries : null}
      </span>
    </span>
  ) : (
    <span className="rollingstock-infos-begin">
      <span className="rollingstock-infos-series">{data.reference}</span>
      {checkUnit(data)}
      <span className="rollingstock-infos-subseries">{data.detail}</span>
    </span>
  );
  const family = data.series ? (
    <span className="rollingstock-infos-middle">
      {`${data.family} / ${data.type} / ${data.grouping}`}
    </span>
  ) : null;
  const end = <span className="rollingstock-infos-end">{data.name}</span>;
  return (
    <div className="rollingstock-infos">
      {showSeries ? series : null}
      {showMiddle ? family : null}
      {showEnd ? end : null}
    </div>
  );
}

export function comfort2pictogram(comfort) {
  switch (comfort) {
    case 'AC':
      return (
        <span className={`comfort-${comfort}`}>
          <IoIosSnow />
        </span>
      );
    case 'HEATING':
      return (
        <span className={`comfort-${comfort}`}>
          <ImFire />
        </span>
      );
    case 'STANDARD':
      return <span className={`comfort-${comfort}`}>S</span>;
    default:
      return null;
  }
}

RollingStockInfos.defaultProps = {
  showSeries: true,
  showMiddle: true,
  showEnd: true,
};

RollingStockInfos.propTypes = {
  data: PropTypes.object.isRequired,
  showSeries: PropTypes.bool,
  showMiddle: PropTypes.bool,
  showEnd: PropTypes.bool,
};
