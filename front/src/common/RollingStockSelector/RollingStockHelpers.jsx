import React from 'react';
import PropTypes from 'prop-types';
import { IoIosSnow } from 'react-icons/io';
import { ImFire } from 'react-icons/im';

export function checkUnit({ unit, detail, form }) {
  if (unit && unit !== 'US') {
    return <span className={`rollingstock-info-unit${form ? '-form' : ''} ${unit}`}>{unit}</span>;
  }
  if (detail?.search(/UM3/i) !== -1) {
    return (
      <span className={`rollingstock-info-unit${form ? '-form' : ''} UM3${form ? '-form' : ''}`}>
        UM3
      </span>
    );
  }
  if (detail?.search(/UM|MUX/i) !== -1) {
    return (
      <span className={`rollingstock-info-unit${form ? '-form' : ''} UM2${form ? '-form' : ''}`}>
        UM2
      </span>
    );
  }
  return null;
}

// TODO: refactor the form props here and in _rollingStockForm.scss
export function RollingStockInfo({ form, rollingStock, showSeries, showMiddle, showEnd }) {
  const { metadata } = rollingStock;
  return (
    <div className={`rollingstock-info${form}`}>
      {showSeries ? (
        <span className={`rollingstock-info-begin${form}`}>
          <span className={`rollingstock-info-series${form}`}>
            {metadata.series ? metadata.series : metadata?.reference}
          </span>
          {checkUnit(metadata, form)}
          <span className={`rollingstock-info-subseries${form}`}>
            {metadata.series && metadata.series !== metadata.subseries
              ? metadata?.subseries
              : metadata?.detail}
          </span>
        </span>
      ) : null}
      {showMiddle && metadata.series ? (
        <span className={`rollingstock-info-middle${form}`}>
          {`${metadata?.family} / ${metadata?.type} / ${metadata?.grouping}`}
        </span>
      ) : null}
      {showEnd ? <span className={`rollingstock-info-end${form}`}>{rollingStock.name}</span> : null}
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
  form: '',
  showSeries: true,
  showMiddle: true,
  showEnd: true,
};

RollingStockInfo.propTypes = {
  form: PropTypes.string,
  rollingStock: PropTypes.object.isRequired,
  showSeries: PropTypes.bool,
  showMiddle: PropTypes.bool,
  showEnd: PropTypes.bool,
};
