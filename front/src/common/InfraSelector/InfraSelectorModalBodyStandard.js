import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { FaLock } from 'react-icons/fa';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDispatch, useSelector } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { updateInfraID, deleteItinerary } from 'reducers/osrdconf';
import { useTranslation } from 'react-i18next';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

// Test coherence between actual & generated version, eg. if editoast is up to date with data
export function editoastUpToDateIndicator(v, genv) {
  return <span className={`ml-1 text-${v === genv ? 'success' : 'danger'}`}>●</span>;
}

export default function InfraSelectorModalBodyStandard(props) {
  const { infrasList, filter, setFilter, onlySelectionMode } = props;
  const { t } = useTranslation(['translation', 'infraManagement']);
  const dispatch = useDispatch();
  const infraID = useSelector(getInfraID);
  const { closeModal } = useContext(ModalContext);

  const setInfraID = (id) => {
    dispatch(updateInfraID(id));
    dispatch(deleteItinerary());
    if (!onlySelectionMode) {
      closeModal();
    }
  };

  return (
    <>
      <div className="infra-input-filter">
        <InputSNCF
          id="infralist-filter-choice"
          sm
          onChange={(e) => setFilter(e.target.value)}
          value={filter}
          type="text"
          noMargin
          unit={<i className="icons-search" />}
        />
      </div>
      <div className="text-center small text-muted infras-count">
        {infrasList ? `${infrasList.length} ${t('infraManagement:infrasFound')}` : null}
      </div>
      <div className="infraslist" data-testid="infraslist">
        {infrasList.map((infra) => (
          <button
            data-testid={`infraslist-item-${infra.id}`}
            type="button"
            onClick={() => {
              setInfraID(infra.id);
            }}
            className={`infraslist-item-choice ${infra.locked ? 'locked' : 'unlocked'} ${
              infra.id === infraID ? 'active' : ''
            }`}
            key={nextId()}
          >
            <div className="infraslist-item-choice-main">
              <span className="infraslist-item-choice-name">{infra.name}</span>
              {infra.locked ? (
                <span className="infra-lock">
                  <small>{t('infraManagement:locked')}</small>
                  <FaLock />
                </span>
              ) : null}
            </div>
            <div className="infraslist-item-choice-footer">
              <span className="">ID {infra.id}</span>
              <span className="">RAILJSON V{infra.railjson_version}</span>
              <span className="">
                V{infra.version}
                {editoastUpToDateIndicator(infra.version, infra.generated_version)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

InfraSelectorModalBodyStandard.defaultProps = {
  filter: '',
  onlySelectionMode: false,
};

InfraSelectorModalBodyStandard.propTypes = {
  filter: PropTypes.string,
  infrasList: PropTypes.array.isRequired,
  setFilter: PropTypes.func.isRequired,
  onlySelectionMode: PropTypes.bool,
};
