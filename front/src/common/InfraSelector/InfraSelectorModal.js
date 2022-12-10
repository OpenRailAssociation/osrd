import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import icon from 'assets/pictures/tracks.png';
import iconEdition from 'assets/pictures/tracks_edit.png';
import { get } from 'common/requests';
import { useDebounce } from 'utils/helpers';
import Loader from 'common/Loader';
import { MdClose, MdEditNote, MdList } from 'react-icons/md';
import InfraSelectorModalBodyEdition from './InfraSelectorModalBodyEdition';
import InfraSelectorModalBodyStandard from './InfraSelectorModalBodyStandard';
import { INFRA_URL } from './Consts';

export default function InfraSelectorModal(props) {
  const { modalID } = props;
  const [infrasList, setInfrasList] = useState([]);
  const { t } = useTranslation(['translation', 'infraManagement']);
  const [filter, setFilter] = useState('');
  const [filteredInfrasList, setFilteredInfrasList] = useState([]);
  const [editionMode, setEditionMode] = useState(false);
  const [mustRefresh, setMustRefresh] = useState(true);

  const debouncedFilter = useDebounce(filter, 250);

  function filterInfras(filteredInfrasListLocal) {
    if (debouncedFilter && debouncedFilter !== '') {
      filteredInfrasListLocal = infrasList.filter((infra) =>
        infra.name.toLowerCase().includes(debouncedFilter.toLowerCase())
      );
    }
    filteredInfrasListLocal.sort((a, b) => a.name.localeCompare(b.name));
    setFilteredInfrasList(filteredInfrasListLocal);
  }

  const getInfrasList = async () => {
    try {
      const infrasListQuery = await get(INFRA_URL, {});
      setInfrasList(infrasListQuery);
      filterInfras(infrasListQuery);
      setMustRefresh(false);
    } catch (e) {
      console.log('ERROR', e);
      setMustRefresh(false);
    }
  };

  useEffect(() => {
    if (infrasList) {
      filterInfras(infrasList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilter]);

  useEffect(() => {
    if (mustRefresh) {
      getInfrasList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustRefresh]);

  return (
    <ModalSNCF htmlID={modalID} size={editionMode ? 'lg' : 'md'}>
      <ModalHeaderSNCF>
        <div className="d-flex align-items-center h1 w-100">
          <img src={editionMode ? iconEdition : icon} alt="infra schema" width="32px" />
          <span className="w-100 text-center">
            {editionMode ? t('infraManagement:infraManagement') : t('infraManagement:infraChoice')}
          </span>
        </div>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        {mustRefresh ? (
          <div className="infra-loader-absolute">
            <Loader position="center" />
          </div>
        ) : null}
        {editionMode ? (
          <InfraSelectorModalBodyEdition
            infrasList={filteredInfrasList}
            setFilter={setFilter}
            filter={filter}
            setMustRefresh={setMustRefresh}
          />
        ) : (
          <InfraSelectorModalBodyStandard
            infrasList={filteredInfrasList}
            setFilter={setFilter}
            filter={filter}
          />
        )}
        <div className="row mt-3">
          <div className="col-md-6">
            <button
              className="btn btn-secondary btn-sm btn-block"
              type="button"
              data-dismiss="modal"
            >
              <MdClose />
              <span className="ml-2">{t('translation:common.close')}</span>
            </button>
          </div>
          <div className="col-md-6">
            <button
              className="btn btn-primary btn-sm btn-block "
              type="button"
              onClick={() => setEditionMode(!editionMode)}
            >
              {editionMode ? (
                <>
                  <MdList />
                  <span className="ml-2">{t('infraManagement:goToStandardMode')}</span>
                </>
              ) : (
                <>
                  <MdEditNote />
                  <span className="ml-2">{t('infraManagement:goToEditionMode')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </ModalBodySNCF>
    </ModalSNCF>
  );
}

InfraSelectorModal.propTypes = {
  modalID: PropTypes.string.isRequired,
};
