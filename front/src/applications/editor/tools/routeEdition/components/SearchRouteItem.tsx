import React from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { RouteCandidate } from 'applications/editor/tools/routeEdition/types';

interface SearchRouteItemProps {
  index: number;
  data: RouteCandidate;
  color: string;
  selected: boolean;
  mode: 'normal' | 'selection';
  onSelect: (index: number) => void;
}
export const SearchRouteItem = ({
  index,
  data,
  color,
  selected,
  mode,
  onSelect,
}: SearchRouteItemProps) => {
  const { t } = useTranslation();

  return (
    <div className="d-flex align-items-center justify-content-start mb-2">
      <div
        className="badge small mr-3 text-center text-white"
        style={{ background: mode === 'selection' && !selected ? '#ccc' : color }}
      >
        {index + 1}
      </div>
      <div className="d-flex flex-column flex-grow-1">
        <div className="text-sm">
          {t('Editor.tools.routes-edition.crossed-track-ranges', {
            count: data.track_ranges.length,
          })}
        </div>
        <div className="text-sm">
          {t('Editor.tools.routes-edition.crossed-detectors', {
            count: data.detectors.length,
          })}
        </div>
      </div>
      <div>
        <button
          type="button"
          className={cx('btn btn-sm', selected ? 'btn-outline-secondary' : 'btn-secondary')}
          onClick={() => onSelect(index)}
        >
          {selected ? t('common.cancel') : t('Editor.tools.routes-edition.preview-candidate')}
        </button>
      </div>
    </div>
  );
};

export default SearchRouteItem;
