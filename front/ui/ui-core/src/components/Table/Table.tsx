import React from 'react';

import { type AmbientVariant, TABLE_AMBIENT_THEMES } from './tableAmbientThemes';

interface TableColumn {
  key: string;
  label: string;
  className?: string;
}

type TableValue = string | number | boolean | null | undefined;
interface TableProps {
  columns: Array<TableColumn>;
  data: Array<Record<string, TableValue>>;
  ambientVariant?: AmbientVariant;
}

const Table = ({ columns, data, ambientVariant = 'B' }: TableProps) => {
  const theme = TABLE_AMBIENT_THEMES[ambientVariant];
  return (
    <table
      className="table-container ambient"
      style={
        {
          '--mix-color-1': theme.mix1,
          '--mix-color-2': theme.mix2,
          '--row-bg-odd': theme.odd,
          '--row-bg-even': theme.even,
        } as React.CSSProperties
      }
    >
      <thead>
        <tr>
          {columns.map((col) => (
            <td key={col.key} className={col.className}>
              {col.label}
            </td>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.key} className={col.className}>
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Table;
