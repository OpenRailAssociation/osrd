import React, { useEffect } from 'react';

interface TableColumn {
  key: string;
  label: string;
  className?: string;
}

type TableValue = string | number | boolean | null | undefined;
interface TableProps {
  columns: Array<TableColumn>;
  data: Array<Record<string, TableValue>>;
}

const Table = ({ columns, data }: TableProps) => {
  useEffect(() => {
    const colOp = document.querySelector('.col-op');
    const table = document.querySelector('.table-container');

    if (!colOp || !table) return;

    const ro = new ResizeObserver(([entry]) => {
      table.classList.toggle('col-op-narrow', entry.contentRect.width < 160);
    });

    ro.observe(colOp);

    return () => ro.disconnect();
  }, []);

  return (
    <table className="table-container">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} className={col.className}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx}>
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
