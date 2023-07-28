import React, { useContext } from 'react';
import nextId from 'react-id-generator';
import { FaLock } from 'react-icons/fa';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDispatch, useSelector } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { updateInfraID, deleteItinerary } from 'reducers/osrdconf';
import { useTranslation } from 'react-i18next';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Infra } from 'common/api/osrdEditoastApi';

type InfraSelectorModalBodyStandardProps = {
  filter: string;
  setFilter: (filterInput: string) => void;
  infrasList: Infra[];
  onlySelectionMode: boolean;
  onInfraChange?: (infraId: number) => void;
};

// Test coherence between actual & generated version, eg. if editoast is up to date with data
export function editoastUpToDateIndicator(
  infraVersion: string,
  infraGeneratedVersion: string | null
) {
  return (
    <span className={`ml-1 text-${infraVersion === infraGeneratedVersion ? 'success' : 'danger'}`}>
      ●
    </span>
  );
}

export default function InfraSelectorModalBodyStandard({
  filter = '',
  setFilter,
  infrasList,
  onlySelectionMode = false,
  onInfraChange,
}: InfraSelectorModalBodyStandardProps) {
  const { t } = useTranslation(['translation', 'infraManagement']);
  const dispatch = useDispatch();
  const infraID = useSelector(getInfraID);
  const { closeModal } = useContext(ModalContext);

  function setInfraID(id: number) {
    dispatch(updateInfraID(id));
    if (onInfraChange) onInfraChange(id);
    dispatch(deleteItinerary());
    if (!onlySelectionMode) {
      closeModal();
    }
  }

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
        {infrasList && t('infraManagement:infrasFound', { count: infrasList.length })}
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
