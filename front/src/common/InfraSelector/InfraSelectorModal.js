import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { updateInfraID, updateTimetableID, deleteItinerary } from 'reducers/osrdconf';
import nextId from 'react-id-generator';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import icon from 'assets/pictures/tracks.svg';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { FaLock, FaLockOpen, FaTrash } from 'react-icons/fa';
import { lowerCase } from 'lodash';
import { useDebounce } from 'utils/helpers';

export default function InfraSelectorModal(props) {
  const dispatch = useDispatch();
  const { infrasList, modalID } = props;
  const { t } = useTranslation(['translation', 'infraManagement']);
  const [filter, setFilter] = useState();
  const [filteredInfrasList, setFilteredInfrasList] = useState();

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

  const setInfraID = (id) => {
    dispatch(updateInfraID(id));
    dispatch(updateTimetableID(undefined));
    dispatch(deleteItinerary());
  };

  useEffect(() => {
    if (infrasList !== undefined) {
      filterInfras(infrasList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilter]);

  return (
    <ModalSNCF htmlID={modalID} size="lg">
      <ModalHeaderSNCF>
        <div className="d-flex align-items-center h1">
          <img className="mr-3" src={icon} alt="infra schema" width="48px" />
          {t('infraManagement:infraManagement')}
        </div>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="row">
          <div className="col-lg-6">
            <div className="mb-2">
              <InputSNCF
                sm
                onChange={(e) => setFilter(e.target.value)}
                value={filter}
                type="text"
                noMargin
                unit={<i className="icons-search" />}
              />
            </div>
            <div className="text-center small text-muted">
              {filteredInfrasList
                ? `${filteredInfrasList.length} ${t('infraManagement:infrasFound')}`
                : null}
            </div>
            <div className="osrd-config-infraslist">
              {filteredInfrasList !== undefined
                ? filteredInfrasList.map((infra) => (
                    <div className="osrd-config-infraslist-item" key={nextId()}>
                      <button className="osrd-config-infraslist-item-lock" type="button">
                        {infra.locked ? (
                          <span className="text-danger">
                            <FaLock />
                          </span>
                        ) : (
                          <span className="text-success">
                            <FaLockOpen />
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfraID(infra.id)}
                        data-dismiss="modal"
                        className="osrd-config-infraslist-item-name"
                      >
                        <span className="text-primary small mr-2">{infra.id}</span>
                        <span className="flex-grow-1">{infra.name}</span>
                      </button>
                      <button className="osrd-config-infraslist-item-delete" type="button">
                        <FaTrash />
                      </button>
                    </div>
                  ))
                : null}
            </div>
          </div>
          <div className="col-lg-6" />
        </div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <button className="btn btn-secondary btn-sm btn-block" type="button" data-dismiss="modal">
          {t('translation:common.cancel')}
        </button>
      </ModalFooterSNCF>
    </ModalSNCF>
  );
}

InfraSelectorModal.propTypes = {
  infrasList: PropTypes.array,
  modalID: PropTypes.string.isRequired,
};
InfraSelectorModal.defaultProps = {
  infrasList: undefined,
};
