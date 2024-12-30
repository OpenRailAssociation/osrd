import { useCallback, useContext } from 'react';

import { Lock, Search } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useNavigate } from 'react-router-dom';

import type { Infra } from 'common/api/osrdEditoastApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useInfraActions, useInfraID, useOsrdContext } from 'common/osrdContext';
import { MODES } from 'main/consts';
import { deleteItinerary } from 'reducers/osrdconf/operationalStudiesConf';
import { useAppDispatch } from 'store';

type InfraSelectorModalBodyStandardProps = {
  filter: string;
  setFilter: (filterInput: string) => void;
  infrasList: Infra[];
  onlySelectionMode: boolean;
  isInEditor?: boolean;
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
  isInEditor,
}: InfraSelectorModalBodyStandardProps) {
  const { t } = useTranslation(['translation', 'infraManagement']);
  const dispatch = useAppDispatch();
  const { mode } = useOsrdContext();
  const { updateInfraID } = useInfraActions();
  const infraID = useInfraID();
  const { closeModal } = useContext(ModalContext);
  const navigate = useNavigate();

  const setInfraID = useCallback(
    (id: number) => {
      dispatch(updateInfraID(id));
      if (isInEditor) {
        navigate(`/editor/${id}`);
      }
      if ([MODES.simulation, MODES.stdcm].includes(mode)) dispatch(deleteItinerary());
      if (!onlySelectionMode) {
        closeModal();
      }
    },
    [isInEditor]
  );

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
          unit={<Search />}
        />
      </div>
      <div className="text-center small text-muted infras-count">
        {infrasList && t('infraManagement:infrasFound', { count: infrasList.length })}
      </div>
      <div className="infraslist" data-testid="infra-list">
        {infrasList.map((infra) => (
          <button
            data-testid={`infraslist-item-${infra.id}`}
            type="button"
            onClick={() => {
              setInfraID(infra.id);
            }}
            className={cx('infraslist-item-choice', {
              locked: infra.locked,
              unlocked: !infra.locked,
              active: infra.id === infraID,
            })}
            key={nextId()}
          >
            <div className="infraslist-item-choice-main">
              <span className="infraslist-item-choice-name">{infra.name}</span>
              {infra.locked && (
                <span className="infra-lock">
                  <small>{t('infraManagement:locked')}</small>
                  <Lock />
                </span>
              )}
            </div>
            <div className="infraslist-item-choice-footer">
              <span>ID {infra.id}</span>
              <span>RAILJSON V{infra.railjson_version}</span>
              <span>
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
