import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { FaLock, FaLockOpen, FaTrash } from 'react-icons/fa';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';

export default function InfraSelectorModalBodyEdition(props) {
  const { infrasList, setFilter, filter } = props;
  const { t } = useTranslation(['translation', 'infraManagement']);
  return (
    <div className="row">
      <div className="col-lg-6">
        <div className="mb-2">
          <InputSNCF
            id="infralist-filter-manage"
            sm
            onChange={(e) => setFilter(e.target.value)}
            value={filter}
            type="text"
            noMargin
            unit={<i className="icons-search" />}
          />
        </div>
        <div className="text-center small text-muted">
          {infrasList ? `${infrasList.length} ${t('infraManagement:infrasFound')}` : null}
        </div>
        <div className="infraslist">
          {infrasList.map((infra) => (
            <div className="infraslist-item" key={nextId()}>
              <button className="infraslist-item-lock" type="button">
                {infra.locked ? (
                  <span className="text-danger">
                    <FaLock />
                  </span>
                ) : (
                  <span className="text-success">
                    <FaLockOpen />
                  </span>
                )}
              </button>
              <div className="infraslist-item-name">
                <span className="text-primary small mr-2">{infra.id}</span>
                <span className="flex-grow-1">{infra.name.replace(' (lock)', '')}</span>
              </div>
              <button className="infraslist-item-delete" type="button">
                <FaTrash />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="col-lg-6" />
    </div>
  );
}

InfraSelectorModalBodyEdition.defaultProps = {
  filter: '',
};

InfraSelectorModalBodyEdition.propTypes = {
  filter: PropTypes.string,
  infrasList: PropTypes.array.isRequired,
  setFilter: PropTypes.func.isRequired,
};
