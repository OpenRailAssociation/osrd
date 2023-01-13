import React from 'react';
import PropTypes from 'prop-types';
import { IoIosSnow } from 'react-icons/io';
import { ImFire } from 'react-icons/im';

export function checkUnit({ unit, detail }) {
  let unit_to_display = unit && unit !== 'US' ? unit : null;
  if (!!detail && detail !== "") {
    if (detail.search(/UM3/i) !== -1) {
      unit_to_display = 'UM3'
    }
    else if (detail.search(/UM|MUX/i) !== -1) {
      unit_to_display = 'UM2'
    }
  }
  return unit_to_display
    ? <span className={`rollingstock-infos-unit ${unit_to_display}`}>{unit_to_display}</span>
    : null;
}

export function RollingStockInfos({ data, showSeries, showMiddle, showEnd }) {
  var { metadata } = data;
  return (
    <div className="rollingstock-infos">
      {showSeries ?
        <span className="rollingstock-infos-begin">
          <span className="rollingstock-infos-series">{ metadata.series ? metadata.series : metadata?.reference}</span>
          {checkUnit(metadata)}
          <span className="rollingstock-infos-subseries">
            {metadata.series && metadata.series !== metadata.subseries ? metadata?.subseries : metadata?.detail}
          </span>
        </span>
        : null
      }
      {showMiddle && metadata.series ?
        <span className="rollingstock-infos-middle">
          {`${metadata?.family} / ${metadata?.type} / ${metadata?.grouping}`}
        </span>
        : null
      }
      {showEnd ? <span className="rollingstock-infos-end">{data.name}</span> : null}
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
