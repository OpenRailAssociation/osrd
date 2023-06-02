import React from 'react';
import PropTypes from 'prop-types';
import { IoIosSnow } from 'react-icons/io';
import { ImFire } from 'react-icons/im';

export function checkUnit({ unit, detail, form }) {
  if (unit && unit !== 'US') {
    return <span className={`rollingstock-infos-unit${form ? '-form' : ''} ${unit}`}>{unit}</span>;
  }
  if (detail?.search(/UM3/i) !== -1) {
    return (
      <span className={`rollingstock-infos-unit${form ? '-form' : ''} UM3${form ? '-form' : ''}`}>
        UM3
      </span>
    );
  }
  if (detail?.search(/UM|MUX/i) !== -1) {
    return (
      <span className={`rollingstock-infos-unit${form ? '-form' : ''} UM2${form ? '-form' : ''}`}>
        UM2
      </span>
    );
  }
  return null;
}

// TODO: refactor the form props here and in _rollingStockForm.scss
export function RollingStockInfos({ form, data, showSeries, showMiddle, showEnd }) {
  const { metadata } = data;
  return (
    <div className={`rollingstock-infos${form}`}>
      {showSeries ? (
        <span className={`rollingstock-infos-begin${form}`}>
          <span className={`rollingstock-infos-series${form}`}>
            {metadata.series ? metadata.series : metadata?.reference}
          </span>
          {checkUnit(metadata, form)}
          <span className={`rollingstock-infos-subseries${form}`}>
            {metadata.series && metadata.series !== metadata.subseries
              ? metadata?.subseries
              : metadata?.detail}
          </span>
        </span>
      ) : null}
      {showMiddle && metadata.series ? (
        <span className={`rollingstock-infos-middle${form}`}>
          {`${metadata?.family} / ${metadata?.type} / ${metadata?.grouping}`}
        </span>
      ) : null}
      {showEnd ? <span className={`rollingstock-infos-end${form}`}>{data.name}</span> : null}
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
  form: '',
  showSeries: true,
  showMiddle: true,
  showEnd: true,
};

RollingStockInfos.propTypes = {
  form: PropTypes.string,
  data: PropTypes.object.isRequired,
  showSeries: PropTypes.bool,
  showMiddle: PropTypes.bool,
  showEnd: PropTypes.bool,
};
