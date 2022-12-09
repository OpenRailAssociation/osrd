import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import icon from 'assets/pictures/tracks.png';
import iconEdition from 'assets/pictures/tracks_edit.png';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { get } from 'common/requests';
import { lowerCase } from 'lodash';
import { useDebounce } from 'utils/helpers';
import InfraSelectorModalBodyEdition from './InfraSelectorModalBodyEdition';
import InfraSelectorModalBodyStandard from './InfraSelectorModalBodyStandard';

const infraURL = '/editoast/infra/';

export default function InfraSelectorModal(props) {
  const { modalID } = props;
  const [infrasList, setInfrasList] = useState([]);
  const { t } = useTranslation(['translation', 'infraManagement']);
  const [filter, setFilter] = useState('');
  const [filteredInfrasList, setFilteredInfrasList] = useState([]);
  const [editionMode, setEditionMode] = useState(false);

  const debouncedFilter = useDebounce(filter, 500);

  function filterInfras(filteredInfrasListLocal) {
    if (debouncedFilter && debouncedFilter !== '') {
      filteredInfrasListLocal = infrasList.filter((infra) =>
        lowerCase(infra.name).includes(lowerCase(debouncedFilter))
      );
    }
    filteredInfrasListLocal.sort((a, b) => a.name.localeCompare(b.name));
    setFilteredInfrasList(filteredInfrasListLocal);
  }

  const getInfrasList = async () => {
    try {
      const infrasListQuery = await get(infraURL, {});
      setInfrasList(infrasListQuery);
      filterInfras(infrasListQuery);
    } catch (e) {
      console.log('ERROR', e);
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
    <ModalSNCF htmlID={modalID} size={editionMode ? 'lg' : 'sm'}>
      <ModalHeaderSNCF>
        <div className="d-flex align-items-center h1">
          <img
            className="mr-3"
            src={editionMode ? iconEdition : icon}
            alt="infra schema"
            width="32px"
          />
          {editionMode ? t('infraManagement:infraManagement') : t('infraManagement:infraChoice')}
        </div>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
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
          />
        )}
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex justify-content-between w-100">
          <button
            className="btn btn-secondary btn-sm flex-grow-1 mr-1"
            type="button"
            data-dismiss="modal"
          >
            {t('translation:common.cancel')}
          </button>
          <button
            className="btn btn-warning btn-sm flex-grow-1 ml-1"
            type="button"
            onClick={() => setEditionMode(!editionMode)}
          >
            {editionMode
              ? t('infraManagement:goToStandardMode')
              : t('infraManagement:goToEditionMode')}
          </button>
        </div>
      </ModalFooterSNCF>
    </ModalSNCF>
  );
}

InfraSelectorModal.propTypes = {
  modalID: PropTypes.string.isRequired,
};
