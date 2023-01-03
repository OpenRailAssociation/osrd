import React from 'react';
import { useTranslation } from 'react-i18next';
import { BsFillExclamationCircleFill, BsFillExclamationTriangleFill } from 'react-icons/bs';

import Loader from '../../../../common/Loader';
import { useInfraErrors, ApiResultItem } from '../../hooks/useInfraErrors';

interface InfraErrorsListProps {
  infraID: number;
}

const InfraErrorsList: React.FC<InfraErrorsListProps> = ({ infraID }) => {
  const { t } = useTranslation();
  const { loading, error, hasNext, total, data, fetch } = useInfraErrors(infraID);

  return (
    <div>
      {loading && <Loader />}
      {error && <p className="text-danger">{t('Editor.infra-errors.list.error')}</p>}
      {data && (
        <ul className="list-group">
          {data.map((error, index) => (
            <li key={index} className="list-group-item management-item">
              <InfraError error={error} />
            </li>
          ))}
        </ul>
      )}
      {!loading && (!data || data.length === 0) && (
        <p className="text-info">{t('Editor.infra-errors.list.no-error')}</p>
      )}
    </div>
  );
};

export const InfraError: React.FC<{ error: ApiResultItem }> = ({ error }) => {
  const { t } = useTranslation();
  return (
    <div className="management-item-content">
      <div className="management-item-symbol d-flex align-items-top">
        {error.information.is_warning ? (
          <BsFillExclamationTriangleFill className="text-warning" />
        ) : (
          <BsFillExclamationCircleFill className="text-danger" />
        )}
      </div>
      <div className="management-item-main">
        <h5 className="font-weight-bold">
          {t(`Editor.infra-errors.error_type.${error.information.error_type}`)}
        </h5>
        <ul className="meta-list font-weight-medium">
          <li className="meta-list-item">{error.information.obj_type}</li>
          <li className="meta-list-item separator">{error.information.obj_id}</li>
          {error.information.field && error.information.field !== '' && (
            <li className="meta-list-item separator">{error.information.field}</li>
          )}
        </ul>
      </div>
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
            <i className="icons-options icons-size-1x75" aria-hidden="true"></i>
          </button>
          <div id="dropdown1" className="dropdown-menu dropdown-menu-right">
            <ul>
              <li>
                <button className="dropdown-item" type="button">
                  Déclencher le suivi
                </button>
              </li>
              <li>
                <button className="dropdown-item" type="button" title="Télécharger (pdf 50mo)">
                  Télécharger
                </button>
              </li>
              <li>
                <button className="dropdown-item" type="button">
                  Supprimer
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfraErrorsList;
