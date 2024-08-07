import React, { type FC, useMemo } from 'react';

import { debounce, sortBy } from 'lodash';
import { useMap } from 'react-map-gl/maplibre';

import IncompatibleConstraintItem from './IncompatibleConstraintsItem';
import type { IncompatibleConstraintEnhanced } from './types';

interface IncompatibleConstraintListProps {
  data: Array<IncompatibleConstraintEnhanced>;
  hovered: Set<string>;
  selected: Set<string>;
  onHover: (itemId: string | null) => void;
  onSelect: (itemId: string) => void;
}

const IncompatibleConstraintsList: FC<IncompatibleConstraintListProps> = ({
  data,
  hovered,
  selected,
  onHover,
  onSelect,
}) => {
  const map = useMap();
  const items = useMemo(() => sortBy(data, ['start', 'end']), [data]);

  return (
    <>
      {items.map((item) => {
        const isHovered = hovered.has(item.id);
        const isSelected = selected.has(item.id);
        return (
          <IncompatibleConstraintItem
            key={`${item.id}-${isHovered}-${isSelected}`}
            data={item}
            isHovered={isHovered}
            isSelected={isSelected}
            onEnter={debounce(() => onHover(item.id), 100)}
            onLeave={() => onHover(null)}
            onClick={() => onSelect(item.id)}
            gotoMap={() => {
              if (!isSelected) onSelect(item.id);
              map.current?.fitBounds(item.bbox);
            }}
          />
        );
      })}
    </>
  );
};

export default IncompatibleConstraintsList;