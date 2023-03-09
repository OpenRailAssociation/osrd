import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import icon from 'assets/pictures/components/tracks.svg';
import iconEdition from 'assets/pictures/components/tracks_edit.svg';
import { get } from 'common/requests';
import { useDebounce } from 'utils/helpers';
import Loader from 'common/Loader';
import { MdEditNote, MdList } from 'react-icons/md';
import InfraSelectorModalBodyEdition from './InfraSelectorModalBodyEdition';
import InfraSelectorModalBodyStandard from './InfraSelectorModalBodyStandard';
import { INFRA_URL } from './Consts';

type InfraListType = { id: number; name: string }[];
type InfraType = { name: string };
type Props = {
  onlySelectionMode?: boolean;
  onInfraChange?: (infraId: number) => void;
};

export default function InfraSelectorModal({ onInfraChange, onlySelectionMode = false }: Props) {
  const [infrasList, setInfrasList] = useState([]);
  const { t } = useTranslation(['translation', 'infraManagement']);
  const [filter, setFilter] = useState('');
  const [filteredInfrasList, setFilteredInfrasList] = useState<InfraListType>([]);
  const [editionMode, setEditionMode] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const debouncedFilter = useDebounce(filter, 250);

  function filterInfras(filteredInfrasListLocal: InfraListType) {
    if (debouncedFilter && debouncedFilter !== '') {
      filteredInfrasListLocal = infrasList.filter((infra: InfraType) =>
        infra.name.toLowerCase().includes(debouncedFilter.toLowerCase())
      );
    }
    filteredInfrasListLocal.sort((a, b) => a.name.localeCompare(b.name));
    setFilteredInfrasList(filteredInfrasListLocal);
  }

  const getInfrasList = async () => {
    setIsFetching(true);
    try {
      const infrasListQuery = await get(INFRA_URL);
      setInfrasList(infrasListQuery);
      filterInfras(infrasListQuery);
      setIsFetching(false);
    } catch (e) {
      setIsFetching(false);
    }
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
}
