import React from 'react';
import { IoIosSnow } from 'react-icons/io';
import { ImFire } from 'react-icons/im';
import { Comfort, LightRollingStock } from 'common/api/osrdEditoastApi';
import { BiLockAlt } from 'react-icons/bi';

const RollingStockUnit = ({ unit, detail }: { unit: string; detail: string }) => {
  if (unit && unit !== 'US') {
    return <span className={`rollingstock-info-unit ${unit}`}>{unit}</span>;
  }
  if (detail.search(/UM3/i) !== -1) {
    return <span className="rollingstock-info-unit UM3">UM3</span>;
  }
  if (detail.search(/UM|MUX/i) !== -1) {
    return <span className="rollingstock-info-unit UM2">UM2</span>;
  }
  return null;
};

interface RollingStockInfoProps {
  rollingStock: LightRollingStock;
  showSeries?: boolean;
  showMiddle?: boolean;
  showEnd?: boolean;
}

export const RollingStockInfo = ({
  rollingStock,
  showSeries = true,
  showMiddle = true,
  showEnd = true,
}: RollingStockInfoProps) => {
  const { metadata } = rollingStock;
  return (
    <div className="d-flex">
      {rollingStock.locked && (
        <span className="pr-1">
          <BiLockAlt />
        </span>
      )}
      <div className="rollingstock-info w-100">
        {showSeries ? (
          <span className="rollingstock-info-begin">
            <span className="rollingstock-info-series">
              {metadata.series ? metadata.series : metadata.reference}
            </span>
            <RollingStockUnit unit={metadata.unit} detail={metadata.detail} />
            <span className="rollingstock-info-subseries">
              {metadata.series && metadata.series !== metadata.subseries
                ? metadata.subseries
                : metadata.detail}
            </span>
          </span>
        ) : null}
        {showMiddle && metadata.series ? (
          <span className="rollingstock-info-middle">
            {`${metadata.family} / ${metadata.type} / ${metadata.grouping}`}
          </span>
        ) : null}
        {showEnd ? <span className="rollingstock-info-end">{rollingStock.name}</span> : null}
      </div>
    </div>
  );
};

export function comfort2pictogram(comfort: Comfort | undefined) {
  switch (comfort) {
    case 'AC':
      return (
        <span className="comfort-AC">
          <IoIosSnow />
        </span>
      );
    case 'HEATING':
      return (
        <span className="comfort-HEATING">
          <ImFire />
        </span>
      );
    case 'STANDARD':
      return <span className="comfort-STANDARD">S</span>;
    default:
      return null;
  }
}
