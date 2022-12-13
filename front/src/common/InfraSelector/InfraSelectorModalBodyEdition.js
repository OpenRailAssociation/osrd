import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { post } from 'common/requests';
import { VscJson } from 'react-icons/vsc';
import InfraSelectorEditionItem from './InfraSelectorEditionItem';
import { INFRA_URL, INFRA_URL_OLD } from './Consts';

export default function InfraSelectorModalBodyEdition(props) {
  const { infrasList, setFilter, filter, getInfrasList } = props;
  const [isFocused, setIsFocused] = useState();
  const [runningDelete, setRunningDelete] = useState();
  const [nameNewInfra, setNameNewInfra] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState();
  const { t } = useTranslation(['translation', 'infraManagement']);

  const validateFile = async (fileToValidate) => {
    if (fileToValidate.type !== 'application/json') {
      setErrorMessage(t('customget:notJSONFormat'));
      return false;
    }
    if (fileToValidate.size === 0) {
      setErrorMessage(t('customget:emptyFile'));
      return false;
    }
    try {
      JSON.parse(await fileToValidate.text());
    } catch (e) {
      setErrorMessage(t('customget:badJSON'));
      return false;
    }
    return true;
  };

  const handleSelect = async (event) => {
    const status = await validateFile(event.target.files[0]);
    if (status === true) {
      setErrorMessage(undefined);
      setSelectedFile(event.target.files[0]);
    }
  };

  async function addNewInfra() {
    if (nameNewInfra !== '') {
      try {
        if (selectedFile) {
          await post(`${INFRA_URL_OLD}railjson/`, JSON.parse(await selectedFile.text()));
          setSelectedFile(undefined);
        } else {
          await post(`${INFRA_URL}`, { name: nameNewInfra });
        }
        getInfrasList();
        setErrorMessage(undefined);
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
              getInfrasList={getInfrasList}
            />
          ))}
        </div>
      </div>
      <div className="col-md-5">
        <h1 className="text-center text-success mb-1">{t('infraManagement:createInfra')}</h1>
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
          <div className="infra-add-import">
            {selectedFile ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="infra-add-import-input-file with-file">
                  <VscJson />
                  <span className="ml-2">{selectedFile.name}</span>
                  <input type="file" onChange={handleSelect} accept=".json" />
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger btn-block mt-1 mb-2"
                  onClick={() => setSelectedFile(undefined)}
                >
                  {t('infraManagement:addInfraJSONFileRemove')}
                </button>
              </>
            ) : (
              <>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="infra-add-import-input-file">
                  <VscJson />
                  <span className="flex-grow-1 text-center">
                    {t('infraManagement:addInfraJSONFile')}
                  </span>
                  <input type="file" onChange={handleSelect} accept=".json" />
                </label>
              </>
            )}
          </div>
          <button
            className="btn btn-sm btn-success btn-block text-wrap"
            onClick={addNewInfra}
            type="button"
          >
            {selectedFile ? t('infraManagement:addInfraJSON') : t('infraManagement:addInfra')}
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
  getInfrasList: PropTypes.func.isRequired,
};
