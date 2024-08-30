import React, { useMemo } from 'react';

import { Search } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { OptionsStateType } from 'applications/editor/tools/routeEdition/types';
import { LoaderFill } from 'common/Loaders';

import { SearchRouteItem } from './SearchRouteItem';

interface SearchRouteProps {
  searchFn: () => void;
  selectFn: (i: number) => void;
  state: OptionsStateType;
  disabled: boolean;
  isNew: boolean;
}

export const SearchRoute = ({ searchFn, selectFn, state, disabled, isNew }: SearchRouteProps) => {
  const { t } = useTranslation();

  const focusedOptionIndex = useMemo(
    () => (state.type === 'options' ? state.focusedOptionIndex : null),
    [state]
  );
  return (
    <div>
      <button
        className="btn btn-primary btn-sm my-1 w-100"
        disabled={state.type === 'loading' || disabled}
        type="button"
        onClick={searchFn}
      >
        <Search /> {t(`Editor.tools.routes-edition.search-routes${!isNew ? '-alt' : ''}`)}
      </button>

      {state.type === 'loading' && <LoaderFill />}
      {state.type === 'options' && (
        <div>
          {state.options.length === 0 && (
            <div className="text-muted text-center">
              {t('Editor.tools.routes-edition.routes', { count: 0 })}
            </div>
          )}

          {state.options.map((candidate, i) => (
            <SearchRouteItem
              key={i}
              index={i}
              selected={focusedOptionIndex === i}
              mode={typeof focusedOptionIndex === 'number' ? 'selection' : 'normal'}
              onSelect={selectFn}
              {...candidate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchRoute;
