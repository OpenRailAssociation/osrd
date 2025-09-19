import React, { useCallback, useMemo, useState, useRef } from 'react';

import { Input } from '@osrd-project/ui-core';
import * as Icons from '@osrd-project/ui-icons';

import { ErrorBoundary } from './ErrorBoundary';

type IconProps = {
  size: 'sm' | 'lg';
  variant: 'base' | 'fill';
  title?: string;
  iconColor: string;
};

type IconEntry = {
  name: string;
  icon: React.ComponentType<IconProps>;
};

const ICONS: IconEntry[] = Object.keys(Icons).map((name) => ({
  name,
  icon: (Icons as Record<string, IconEntry['icon']>)[name],
}));

export const SearchIcons = (args: IconProps) => {
  // eslint-disable-next-line no-console
  console.log(args);
  const [search, setSearch] = useState('');
  const debounceTimer = useRef<null | number>(null);
  const debouncedOnSearch = useCallback(
    (searchString: string) => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = window.setTimeout(() => {
        setSearch(searchString);
      }, 200);
    },
    [debounceTimer]
  );
  const icons = useMemo(
    () => ICONS.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <div>
      <Input
        id="search"
        label="Search"
        type="text"
        onChange={(e) => debouncedOnSearch(e.target.value)}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'start' }}>
        {icons.map((i) => (
          <ErrorBoundary key={`${JSON.stringify(args)}-${i.name}`}>
            <div
              className="flex"
              style={{
                margin: '1em',
                display: 'flex',
                flexDirection: 'column',
                width: '3em',
                alignItems: 'center',
              }}
            >
              <i.icon {...args} />
              <span style={{ fontSize: '0.5em' }}>{i.name}</span>
            </div>
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
};
