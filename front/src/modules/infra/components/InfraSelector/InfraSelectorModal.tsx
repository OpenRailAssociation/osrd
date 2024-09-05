import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { MdEditNote, MdList } from 'react-icons/md';

import icon from 'assets/pictures/components/tracks.svg';
import iconEdition from 'assets/pictures/components/tracks_edit.svg';
import { type Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { Loader } from 'common/Loaders';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';

import InfraSelectorModalBodyEdition from './InfraSelectorModalBodyEdition';
import InfraSelectorModalBodyStandard from './InfraSelectorModalBodyStandard';

type InfraSelectorModalProps = {
  onlySelectionMode?: boolean;
  isInEditor?: boolean;
};

const InfraSelectorModal = ({ onlySelectionMode = false, isInEditor }: InfraSelectorModalProps) => {
  const { t } = useTranslation(['translation', 'infraManagement']);
  const dispatch = useAppDispatch();
  const [filter, setFilter] = useState('');
  const [filteredInfrasList, setFilteredInfrasList] = useState<Infra[]>([]);
  const [editionMode, setEditionMode] = useState(false);
  const {
    data: infrasList,
    isSuccess,
    isLoading,
    isError,
    error,
  } = osrdEditoastApi.endpoints.getInfra.useQuery({ pageSize: 1000 });

  const debouncedFilter = useDebounce(filter, 250);

  function filterInfras(infrasListLocal: Infra[]) {
    if (debouncedFilter && debouncedFilter !== '') {
      infrasListLocal = infrasListLocal.filter((infra) =>
        infra.name.toLowerCase().includes(debouncedFilter.toLowerCase())
      );
    }
    const filteredInfrasListLocal = infrasListLocal
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    setFilteredInfrasList(filteredInfrasListLocal);
  }

  useEffect(() => {
    if (infrasList?.results) {
      filterInfras(infrasList.results);
    }
  }, [debouncedFilter]);

  useEffect(() => {
    if (isError && error) {
      dispatch(
        setFailure(
          castErrorToFailure(error, {
            name: t('infraManagement:errorMessages.unableToRetrieveInfraList'),
          })
        )
      );
    }
  }, [isError]);

  useEffect(() => {
    if (isSuccess && infrasList?.results && infrasList.results.length > 0) {
      filterInfras(infrasList.results);
    }
  }, [isSuccess, infrasList]);

  return (
    <>
      <ModalHeaderSNCF withCloseButton={!onlySelectionMode}>
        <div className="d-flex align-items-center h1 w-100">
          <img src={editionMode ? iconEdition : icon} alt="infra schema" width="32px" />
          <div className="w-100 text-center d-flex">
            <span className="flex-grow-1">
              {editionMode
                ? t('infraManagement:infraManagement')
                : t('infraManagement:infraChoice')}
            </span>
            {!onlySelectionMode && (
              <button
                className="infra-switch-mode"
                type="button"
                onClick={() => setEditionMode(!editionMode)}
              >
                {editionMode ? (
                  <>
                    <MdList />
                    <span className="ml-1">{t('infraManagement:goToStandardMode')}</span>
                  </>
                ) : (
                  <>
                    <MdEditNote />
                    <span className="ml-1">{t('infraManagement:goToEditionMode')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        {isLoading && (
          <div className="infra-loader-absolute">
            <Loader position="center" />
          </div>
        )}
        {editionMode ? (
          <InfraSelectorModalBodyEdition
            infrasList={filteredInfrasList}
            setFilter={setFilter}
            filter={filter}
          />
        ) : (
          <InfraSelectorModalBodyStandard
            infrasList={filteredInfrasList}
            setFilter={setFilter}
            filter={filter}
            onlySelectionMode={onlySelectionMode}
            isInEditor={isInEditor}
          />
        )}
      </ModalBodySNCF>
    </>
  );
};

export default InfraSelectorModal;
