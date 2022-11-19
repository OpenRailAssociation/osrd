import React from 'react';
import PropTypes from 'prop-types';

export function checkUnit(data) {
  if (data.unit && data.unit !== 'US') {
    return <span className={`rollingstock-infos-unit ${data.unit}`}>{data.unit}</span>;
  }
  if (data.detail.search(/UM3/i) !== -1) {
    return <span className="rollingstock-infos-unit UM3">UM3</span>;
  }
  if (data.detail.search(/UM|MUX/i) !== -1) {
    return <span className="rollingstock-infos-unit UM2">UM2</span>;
  }
  return null;
}

export function RollingStockInfos(props) {
  const { data } = props;
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
  return (
    <div className="rollingstock-infos">
      {series}
      {family}
      <span className="rollingstock-infos-end">{data.name}</span>
    </div>
  );
}

RollingStockInfos.propTypes = {
  data: PropTypes.object.isRequired,
};
