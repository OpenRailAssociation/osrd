import React, { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { BsFillExclamationCircleFill, BsFillExclamationTriangleFill } from 'react-icons/bs';

import { InfraError } from './types';

/**
 * A component that display an infra error.
 * If index is provided, we display it with `#` on the left
 * Children is used o create the drop down menu on the top-right of the component.
 * Children must follow this templating :
 * ```
 * <ul>
 *   <li>
 *     <button
 *       className="dropdown-item"
 *       type="button"
 *       onClick={() => gotoMap(error)}
 *     >
 *       Sélectionner sur la carte
 *     </button>
 *   </li>
 * </ul>
 * ```
 */
const InfraErrorComponent: React.FC<PropsWithChildren<{ error: InfraError; index?: number }>> = ({
  error,
  index,
  children,
}) => {
  const { t } = useTranslation();

  return (
    <div className="management-item-content">
      <div className="management-item-symbol">
        {error.information.is_warning ? (
          <BsFillExclamationTriangleFill className="text-warning" />
        ) : (
          <BsFillExclamationCircleFill className="text-danger" />
        )}
        {index !== undefined && <span className="mt-2 text-muted">#{index}</span>}
      </div>
      <div className="management-item-main">
        <h5 className="font-weight-bold">
          {t(`Editor.infra-errors.error-type.${error.information.error_type}`)}
        </h5>
        <ul className="meta-list font-weight-medium">
          <li className="meta-list-item">{error.information.obj_type}</li>
          <li className="meta-list-item separator">{error.information.obj_id}</li>
          {error.information.field && error.information.field !== '' && (
            <li className="meta-list-item separator">{error.information.field}</li>
          )}
        </ul>
      </div>
      {children && (
        <div className="management-item-action">
          <div className="btn-group dropdown">
            <button
              type="button"
              className="btn btn-options dropdown-toggle"
              data-toggle="dropdown"
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls="dropdown1"
            >
              <span className="sr-only">Actions</span>
              <i className="icons-options icons-size-1x75" aria-hidden="true" />
            </button>
            <div id="dropdown1" className="dropdown-menu dropdown-menu-right">
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfraErrorComponent;
