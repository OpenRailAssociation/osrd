import { useState } from 'react';

import { Search } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { VscJson } from 'react-icons/vsc';

import { type Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import useAuthz from 'common/authorization/hooks/useAuthz';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { Loader } from 'common/Loaders/Loader';
import { useAsyncMemo } from 'utils/useAsyncMemo';

import InfraSelectorEditionItem from './InfraSelectorEditionItem';

type InfraSelectorModalBodyEditionProps = {
  infrasList: Infra[];
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
};

const InfraSelectorModalBodyEdition = ({
  infrasList,
  setFilter,
  filter = '',
}: InfraSelectorModalBodyEditionProps) => {
  const [isFocused, setIsFocused] = useState<number | undefined>(undefined);
  const [nameNewInfra, setNameNewInfra] = useState<string | undefined>('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>('');
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  const { t } = useTranslation();
  const [postInfra] = osrdEditoastApi.endpoints.postInfra.useMutation();
  const [postInfraRailjson, { isLoading: isInfraLoading }] =
    osrdEditoastApi.endpoints.postInfraRailjson.useMutation();

  // Get the user privileges for infras
  const { getUserPrivileges } = useAuthz();
  const userPrivilegesByInfraId = useAsyncMemo(async () => {
    const data = await getUserPrivileges({ infra: infrasList.map((infra) => infra.id) });
    return data.infra || {};
    // redraw is in the deps to force the reload of the privileges when the user changes his own grant
  }, [getUserPrivileges, JSON.stringify(infrasList.map((infra) => infra.id))]);

  const validateFile = async (fileToValidate: File) => {
    if (fileToValidate.size === 0) {
      setErrorMessage(t('jsonUpload.emptyFile'));
      return false;
    }
    try {
      JSON.parse(await fileToValidate.text());
    } catch (e) {
      console.error(e);
      setErrorMessage(t('jsonUpload.badJSON'));
      return false;
    }
    return true;
  };

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const status = await validateFile(event.target.files[0]);
      if (status === true) {
        setErrorMessage(undefined);
        setSelectedFile(event.target.files[0]);
      }
      event.target.value = ''; // Resets the input value to let the onChange retrigger on consecutive inputs with the same file/path, necessary on chrome
    }
  };

  const addNewInfra = async () => {
    if (!nameNewInfra) {
      setErrorMessage(t('infraManagement.errorMessages.noEmptyName'));
      return;
    }

    if (selectedFile) {
      postInfraRailjson({
        name: nameNewInfra,
        railJson: JSON.parse(await selectedFile.text()),
        generateData: true,
      })
        .unwrap()
        .then(() => {
          setSelectedFile(undefined);
          setErrorMessage(undefined);
        })
        .catch(() => {
          setErrorMessage(t('jsonUpload.uploadError'));
        });
    } else {
      postInfra({ body: { name: nameNewInfra } })
        .unwrap()
        .then(() => {
          setErrorMessage(undefined);
        });
    }
  };

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
            unit={<Search />}
          />
        </div>
        <div className="text-center small text-muted">
          {infrasList && t('infraManagement.infrasFound', { count: infrasList.length })}
        </div>
        <div className="infraslist">
          {infrasList.map((infra) => (
            <InfraSelectorEditionItem
              infra={infra}
              key={infra.id}
              isFocused={isFocused}
              setIsFocused={setIsFocused}
              userPrivileges={
                userPrivilegesByInfraId.type === 'ready'
                  ? userPrivilegesByInfraId.data[infra.id]
                  : undefined
              }
            />
          ))}
        </div>
      </div>
      <div className="col-md-5">
        <h1 className="text-center text-success mb-1">{t('infraManagement.createInfra')}</h1>
        <div className="infra-add">
          <InputSNCF
            id="infra-add"
            sm
            onChange={(e) => setNameNewInfra(e.target.value)}
            value={nameNewInfra}
            type="text"
            noMargin
            placeholder={t('infraManagement.infraName')}
          />
          <div className="infra-add-error">{errorMessage}</div>
          <div className="infra-add-import">
            {selectedFile ? (
              <>
                <label className="infra-add-import-input-file with-file">
                  <VscJson />
                  <span className="ml-2" title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                  <input type="file" onChange={handleSelect} accept=".json,.railjson" />
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger btn-block mt-1 mb-2"
                  onClick={() => setSelectedFile(undefined)}
                >
                  {t('infraManagement.addInfraJSONFileRemove')}
                </button>
              </>
            ) : (
              <label className="infra-add-import-input-file">
                <VscJson />
                <span className="flex-grow-1 text-center">
                  {t('infraManagement.addInfraJSONFile')}
                </span>
                <input type="file" onChange={handleSelect} accept=".json,.railjson" />
              </label>
            )}
          </div>
          {isInfraLoading ? (
            <Loader />
          ) : (
            <button
              className="btn btn-sm btn-success btn-block text-wrap"
              onClick={addNewInfra}
              type="button"
            >
              {selectedFile ? t('infraManagement.addInfraJSON') : t('infraManagement.addInfra')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfraSelectorModalBodyEdition;
