import { useTranslation } from 'react-i18next';

import type { RouteEntity } from 'applications/editor/tools/routeEdition/types';

type RouteMetadataProps = {
  entity: RouteEntity;
  disabled: boolean;
  disableTransit: boolean;
  onChange: (e: boolean) => void;
};

export const RouteMetadata = ({
  entity,
  onChange,
  disableTransit,
  disabled,
}: RouteMetadataProps) => {
  const { t } = useTranslation();

  return (
    <div className="form-group" style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="row">
        <span className="col-sm-6 col-form-label">
          {t('Editor.tools.routes-edition.start_direction')}
        </span>
        {!disabled && (
          <div className="col-sm-6">
            <span>
              {t(
                `Editor.tools.routes-edition.directions.${entity.properties.entry_point_direction}`
              )}
            </span>
          </div>
        )}
      </div>
      <div className="row">
        <label className="col-sm-6 col-form-label" htmlFor="include-release-detectors">
          {t('Editor.tools.routes-edition.include-release-detectors')}
        </label>
        <div className="col-sm-6">
          <input
            type="checkbox"
            id="include-release-detectors"
            checked={entity.properties.release_detectors.length === 0}
            disabled={disabled || disableTransit}
            onChange={(e) => onChange(e.target.checked)}
            ref={(input) => {
              if (input) {
                input.indeterminate = disabled;
              }
            }}
          />
        </div>
        {!disabled && (
          <small className="col-sm-12 form-text text-muted" style={{ marginTop: '-1em' }}>
            {t('Editor.tools.routes-edition.locked-release-detectors')}
          </small>
        )}
      </div>
    </div>
  );
};

export default RouteMetadata;
