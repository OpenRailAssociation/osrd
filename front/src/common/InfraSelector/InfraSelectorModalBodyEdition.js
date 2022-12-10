import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { post } from 'common/requests';
import InfraSelectorEditionItem from './InfraSelectorEditionItem';
import { INFRA_URL } from './Consts';

export default function InfraSelectorModalBodyEdition(props) {
  const { infrasList, setFilter, filter, setMustRefresh } = props;
  const [isFocused, setIsFocused] = useState();
  const [runningDelete, setRunningDelete] = useState();
  const [nameNewInfra, setNameNewInfra] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { t } = useTranslation(['translation', 'infraManagement']);

  async function addNewInfra() {
    if (nameNewInfra !== '') {
      try {
        await post(`${INFRA_URL}`, { name: nameNewInfra });
        setMustRefresh(true);
      } catch (e) {
        console.log(e);
      }
    } else {
      setErrorMessage(t('infraManagement:errorMessages.noEmptyName'));
    }
  }

  return (
    <div className="row">
      <div className="col-md-7">
        <div className="infra-input-filter">
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
              runningDelete={runningDelete}
              setRunningDelete={setRunningDelete}
              setIsFocused={setIsFocused}
              setMustRefresh={setMustRefresh}
            />
          ))}
        </div>
      </div>
      <div className="col-md-5">
        <div className="infra-add">
          <InputSNCF
            id="infra-add"
            sm
            onChange={(e) => setNameNewInfra(e.target.value)}
            value={nameNewInfra}
            type="text"
            noMargin
            placeholder={t('infraManagement:infraName')}
          />
          <div className="infra-add-error">{errorMessage}</div>
          <button className="btn btn-sm btn-success btn-block" onClick={addNewInfra} type="button">
            {t('infraManagement:addInfra')}
          </button>
        </div>
      </div>
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
