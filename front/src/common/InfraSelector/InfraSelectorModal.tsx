import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import icon from 'assets/pictures/components/tracks.svg';
import iconEdition from 'assets/pictures/components/tracks_edit.svg';
import { useDebounce } from 'utils/helpers';
import Loader from 'common/Loader';
import { MdEditNote, MdList } from 'react-icons/md';
import { Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import InfraSelectorModalBodyEdition from './InfraSelectorModalBodyEdition';
import InfraSelectorModalBodyStandard from './InfraSelectorModalBodyStandard';

type InfraSelectorModalProps = {
  onlySelectionMode?: boolean;
  onInfraChange?: (infraId: number) => void;
};

const InfraSelectorModal = ({
  onInfraChange,
  onlySelectionMode = false,
}: InfraSelectorModalProps) => {
  const [infrasList, setInfrasList] = useState<Infra[]>([]);
  const { t } = useTranslation(['translation', 'infraManagement']);
  const [filter, setFilter] = useState('');
  const [filteredInfrasList, setFilteredInfrasList] = useState<Infra[]>([]);
  const [editionMode, setEditionMode] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [getInfra] = osrdEditoastApi.endpoints.getInfra.useLazyQuery();

  const debouncedFilter = useDebounce(filter, 250);

  function filterInfras(filteredInfrasListLocal: Infra[]) {
    if (debouncedFilter && debouncedFilter !== '') {
      filteredInfrasListLocal = infrasList.filter((infra) =>
        infra.name.toLowerCase().includes(debouncedFilter.toLowerCase())
      );
    }
    filteredInfrasListLocal.slice().sort((a, b) => a.name.localeCompare(b.name));
    setFilteredInfrasList(filteredInfrasListLocal);
  }

  const getInfrasList = () => {
    setIsFetching(true);
    getInfra()
      .unwrap()
      .then(({ results }) => {
        setInfrasList(results as Infra[]);
        filterInfras(results as Infra[]);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  };

  useEffect(() => {
    if (infrasList) {
      filterInfras(infrasList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilter]);

  useEffect(() => {
    getInfrasList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {isFetching && (
          <div className="infra-loader-absolute">
            <Loader position="center" />
          </div>
        )}
        {editionMode ? (
          <InfraSelectorModalBodyEdition
            infrasList={filteredInfrasList}
            setFilter={setFilter}
            filter={filter}
            getInfrasList={getInfrasList}
          />
        ) : (
          <InfraSelectorModalBodyStandard
            infrasList={filteredInfrasList}
            setFilter={setFilter}
            filter={filter}
            onlySelectionMode={onlySelectionMode}
            onInfraChange={onInfraChange}
          />
        )}
      </ModalBodySNCF>
    </>
  );
};

export default InfraSelectorModal;
