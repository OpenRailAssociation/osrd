import React, { type FC, useMemo } from 'react';

import bbox from '@turf/bbox';
import { sortBy } from 'lodash';
import { useMap } from 'react-map-gl/maplibre';

import IncompatibleConstraintItem from './IncompatibleConstraintsItem';
import type { IncompatibleConstraintItemEnhanced } from './type';

interface IncompatibleContraintListProps {
  data: Array<IncompatibleConstraintItemEnhanced>;
  onHover: (item: IncompatibleConstraintItemEnhanced | null) => void;
  onClick: (item: IncompatibleConstraintItemEnhanced) => void;
}
const IncompatibleConstraintsList: FC<IncompatibleContraintListProps> = ({
  data,
  onHover,
  onClick,
}) => {
  const items = useMemo(() => sortBy(data, ['range.start', 'range.end']), [data]);
  const map = useMap();

  return (
    <>
      {items.map((item) => (
        <IncompatibleConstraintItem
          key={`${item.type}-${item.range.start}-${item.range.end}`}
          data={item}
          highlighted={false}
          onHover={() => onHover(item)}
          onClick={() => onClick(item)}
          gotoMap={() => {
            map.current?.fitBounds(bbox(item.geometry) as [number, number, number, number], {
              linear: true,
            });
          }}
        />
      ))}
    </>
  );
};

export default IncompatibleConstraintsList;
