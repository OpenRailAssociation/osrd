import React from 'react';
import cx from 'classnames';
import './Grid.scss';

type GridProps = {
  data: string[];
  filter?: string;
  extraClass?: string;
  updateData: (data: string) => void;
};

function isFiltered(item: string, filter: string): boolean {
  return filter !== '' && !item.toLocaleLowerCase().includes(filter.toLocaleLowerCase());
}

const Grid = ({ data, filter, extraClass, updateData }: GridProps) => (
  <div className={`grid-list ${extraClass}`}>
    {data.map((item, i) => (
      <button
        key={i}
        type="button"
        title={item}
        className={cx('grid-item', {
          filtered: filter && isFiltered(item, filter),
        })}
        onClick={() => updateData(item)}
      >
        {item}
      </button>
    ))}
  </div>
);

export default Grid;
