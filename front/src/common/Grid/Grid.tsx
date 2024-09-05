import cx from 'classnames';
import { useTranslation } from 'react-i18next';

type GridProps = {
  gridData: string[];
  filter?: string;
  extraClass?: string;
  updateData: (data: string) => void;
  selectorData?: (string | null)[];
};

function isFiltered(item: string, filter: string): boolean {
  return filter !== '' && !item.toLocaleLowerCase().includes(filter.toLocaleLowerCase());
}

function isInSelector(data: (string | null)[], item: string) {
  return data.includes(item);
}

const Grid = ({ gridData, filter, extraClass, updateData, selectorData }: GridProps) => {
  const { t } = useTranslation('translation');
  return (
    <div className={`grid-list ${extraClass}`}>
      {gridData.map((item, i) => (
        <button
          key={i}
          type="button"
          disabled={selectorData && isInSelector(selectorData, item)}
          title={`${item} ${
            selectorData && isInSelector(selectorData, item) ? t('common.selected') : ''
          }`}
          className={cx('grid-item', {
            filtered: filter && isFiltered(item, filter),
            present: selectorData && isInSelector(selectorData, item),
          })}
          onClick={() => updateData(item)}
        >
          <span
            className={cx({
              present: selectorData && isInSelector(selectorData, item),
            })}
          >
            {item}
          </span>
        </button>
      ))}
    </div>
  );
};

export default Grid;
