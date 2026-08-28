import { useState } from 'react';

import { Search } from '@osrd-project/ui-icons';
import cx from 'classnames';
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

type FileSelection = {
  file: File | undefined;
  validating: boolean;
};

const InfraSelectorModalBodyEdition = ({
  infrasList,
  setFilter,
  filter = '',
}: InfraSelectorModalBodyEditionProps) => {
  const [isFocused, setIsFocused] = useState<number | undefined>(undefined);
  const [nameNewInfra, setNameNewInfra] = useState<string | undefined>('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>('');
  const [fileSelection, setFileSelection] = useState<FileSelection>({
    file: undefined,
    validating: false,
  });

  const { t } = useTranslation();
  const [postInfra] = osrdEditoastApi.endpoints.postInfra.useMutation();
  const [postInfraRailjson, { isLoading: isInfraLoading }] =
    osrdEditoastApi.endpoints.postInfraRailjson.useMutation();

  // Get the user privileges for infras
  const { getUserPrivileges } = useAuthz();
  const userPrivilegesByInfraId = useAsyncMemo(async () => {
    const data = await getUserPrivileges({
      rolling_stock: [],
      infra: infrasList.map((infra) => infra.id),
    });
    return data.infra || {};
    // redraw is in the deps to force the reload of the privileges when the user changes his own grant
  }, [getUserPrivileges, JSON.stringify(infrasList.map((infra) => infra.id))]);

  const validateFile = async (fileToValidate: File): Promise<string | null> => {
    if (fileToValidate.size === 0) {
      return t('jsonUpload.emptyFile');
    }
    try {
      JSON.parse(await fileToValidate.text());
    } catch (e) {
      console.error(e);
      return t('jsonUpload.badJSON');
    }
    return null;
  };

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = ''; // Resets the input value to let the onChange retrigger on consecutive inputs with the same file/path, necessary on chrome

    setFileSelection({ file, validating: true });
    const status = await validateFile(file);

    setFileSelection((prev) => {
      if (prev.file !== file) return prev; // File input could have changed during validation

      if (status === true) {
        setErrorMessage(undefined);
        return { file, validating: false };
      }
      setErrorMessage(status);
      return { file: undefined, validating: false };
    });
  };

  const handleUnselect = () => {
    setFileSelection({ file: undefined, validating: false });
    setErrorMessage(undefined);
  };

  const addNewInfra = async () => {
    if (!nameNewInfra) {
      setErrorMessage(t('infraManagement.errorMessages.noEmptyName'));
      return;
    }

    if (fileSelection.file) {
      postInfraRailjson({
        name: nameNewInfra,
        railJson: JSON.parse(await fileSelection.file.text()),
        generateData: true,
      })
        .unwrap()
        .then(() => {
          setFileSelection({ file: undefined, validating: false });
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
            <label
              className={cx('infra-add-import-input-file', {
                'with-file': fileSelection.file,
              })}
            >
              <VscJson />
              {fileSelection.file ? (
                <span className="ml-2" title={fileSelection.file.name}>
                  {fileSelection.file.name}
                </span>
              ) : (
                <span className="flex-grow-1 text-center">
                  {t('infraManagement.addInfraJSONFile')}
                </span>
              )}
              <input type="file" onChange={handleSelect} accept=".json,.railjson" />
            </label>
            {(fileSelection.file || fileSelection.validating) && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger btn-block mt-1 mb-2"
                onClick={handleUnselect}
              >
                {t('infraManagement.addInfraJSONFileRemove')}
              </button>
            )}
          </div>
          {isInfraLoading || fileSelection.validating ? (
            <Loader />
          ) : (
            <button
              className="btn btn-sm btn-success btn-block text-wrap"
              onClick={addNewInfra}
              type="button"
            >
              {fileSelection.file
                ? t('infraManagement.addInfraJSON')
                : t('infraManagement.addInfra')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfraSelectorModalBodyEdition;
