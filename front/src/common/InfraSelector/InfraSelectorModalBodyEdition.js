import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import InfraSelectorEditionItem from './InfraSelectorEditionItem';

export default function InfraSelectorModalBodyEdition(props) {
  const { infrasList, setFilter, filter, setMustRefresh } = props;
  const [isFocused, setIsFocused] = useState();
  const { t } = useTranslation(['translation', 'infraManagement']);
  return (
    <div className="row">
      <div className="col-md-8">
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
            <InfraSelectorEditionItem
              infra={infra}
              key={nextId()}
              isFocused={isFocused}
              setIsFocused={setIsFocused}
              setMustRefresh={setMustRefresh}
            />
          ))}
        </div>
      </div>
      <div className="col-md-4" />
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
  setMustRefresh: PropTypes.func.isRequired,
};
