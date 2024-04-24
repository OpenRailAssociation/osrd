import React from 'react';

import { useTranslation } from 'react-i18next';

import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import EyeToggle from 'common/EyeToggle/EyeToggle';

type RouteListProps = {
  switchesRouteCandidates: string[];
  onRouteHighlight: (routeId: string) => Promise<void>;
  selectedRoutes: string[];
  onRouteSelect: (routeId: string) => Promise<void>;
  highlightedRoutes: string[];
};

function RouteList({
  switchesRouteCandidates,
  onRouteSelect,
  selectedRoutes,
  onRouteHighlight,
  highlightedRoutes,
}: RouteListProps) {
  const { t } = useTranslation();

  return (
    <div className="my-3 w-100">
      <h4 className="pb-0">{t('Editor.tools.speed-edition.select-route')}</h4>
      {switchesRouteCandidates.map((route) => (
        <div key={route} className="d-flex align-items-center justify-content-between w-75">
          {route}
          <div className="d-flex">
            <CheckboxRadioSNCF
              label=""
              id={`route-checkbox-${route}`}
              type="checkbox"
              checked={selectedRoutes.includes(route)}
              onChange={() => onRouteSelect(route)}
            />
            <EyeToggle
              checked={highlightedRoutes.includes(route)}
              onClick={() => onRouteHighlight(route)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default RouteList;
