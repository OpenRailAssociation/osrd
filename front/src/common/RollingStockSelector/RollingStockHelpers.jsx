import React from 'react';
import PropTypes from 'prop-types';
import { IoIosSnow } from 'react-icons/io';
import { ImFire } from 'react-icons/im';

export function checkUnit({ unit, detail }) {
  if (unit && unit !== 'US') {
    return <span className={`rollingstock-info-unit ${unit}`}>{unit}</span>;
  }
  if (detail?.search(/UM3/i) !== -1) {
    return <span className="rollingstock-info-unit UM3">UM3</span>;
  }
  if (detail?.search(/UM|MUX/i) !== -1) {
    return <span className="rollingstock-info-unit UM2">UM2</span>;
  }
  return null;
}

export function RollingStockInfo({ rollingStock, showSeries, showMiddle, showEnd }) {
  const { metadata } = rollingStock;
  return (
    <div className="rollingstock-info">
      {showSeries ? (
        <span className="rollingstock-info-begin">
          <span className="rollingstock-info-series">
            {metadata.series ? metadata.series : metadata?.reference}
          </span>
          {checkUnit(metadata)}
          <span className="rollingstock-info-subseries">
            {metadata.series && metadata.series !== metadata.subseries
              ? metadata?.subseries
              : metadata?.detail}
          </span>
        </span>
      ) : null}
      {showMiddle && metadata.series ? (
        <span className="rollingstock-info-middle">
          {`${metadata?.family} / ${metadata?.type} / ${metadata?.grouping}`}
        </span>
      ) : null}
      {showEnd ? <span className="rollingstock-info-end">{rollingStock.name}</span> : null}
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

RollingStockInfo.defaultProps = {
  showSeries: true,
  showMiddle: true,
  showEnd: true,
};

RollingStockInfo.propTypes = {
  rollingStock: PropTypes.object.isRequired,
  showSeries: PropTypes.bool,
  showMiddle: PropTypes.bool,
  showEnd: PropTypes.bool,
};
