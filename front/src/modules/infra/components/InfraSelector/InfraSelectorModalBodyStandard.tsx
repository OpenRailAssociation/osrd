import { useCallback, useContext, useMemo } from 'react';

import { Lock, Search } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useNavigate } from 'react-router-dom';

import type { Infra } from 'common/api/osrdEditoastApi';
import useResourcesGrants from 'common/authorization/hooks/useResourcesGrants';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useInfraActions, useInfraID, useOsrdContext } from 'common/osrdContext';
import { MODES } from 'main/consts';
import { DEFAULT_GRANT } from 'modules/infra/consts';
import { deleteItinerary } from 'reducers/osrdconf/operationalStudiesConf';
import { useAppDispatch } from 'store';

import InfraSelectorGrantsManager from './InfraSelectorGrantsManager';

type InfraSelectorModalBodyStandardProps = {
  filter: string;
  setFilter: (filterInput: string) => void;
  infrasList: Infra[];
  infraIdsList: number[];
  onlySelectionMode: boolean;
  isInEditor?: boolean;
};

// Test coherence between actual & generated version, eg. if editoast is up to date with data
export function editoastUpToDateIndicator(
  infraVersion: number,
  infraGeneratedVersion: number | null
) {
  return (
    <span className={`ml-1 text-${infraVersion === infraGeneratedVersion ? 'success' : 'danger'}`}>
      ●
    </span>
  );
}

const InfraSelectorModalBodyStandard = ({
  filter = '',
  setFilter,
  infrasList,
  infraIdsList,
  onlySelectionMode = false,
  isInEditor,
}: InfraSelectorModalBodyStandardProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { mode } = useOsrdContext();
  const { updateInfraID } = useInfraActions();
  const infraID = useInfraID();
  const { closeModal } = useContext(ModalContext);
  const navigate = useNavigate();

  const payload = useMemo(() => ({ infra: infraIdsList }), [infraIdsList]);

  const { userResourcesGrants, resourceGrants, usersInfraGrantsByInfraId } =
    useResourcesGrants(payload);

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
        {infrasList && t('infraManagement.infrasFound', { count: infrasList.length })}
      </div>
      <div className="infraslist" data-testid="infra-list">
        {infrasList.map((infra) => {
          const userGrant =
            userResourcesGrants?.infra.find((userInfraGrant) => userInfraGrant.id === infra.id)
              ?.grant || DEFAULT_GRANT;
          return (
            <div
              className={cx('infraslist-item-choice', {
                locked: infra.locked,
                unlocked: !infra.locked,
                active: infra.id === infraID,
              })}
              key={nextId()}
            >
              <button
                className="infraslist-item-choice-main"
                type="button"
                onClick={() => {
                  setInfraID(infra.id);
                }}
              >
                <span className="infraslist-item-choice-name">{infra.name}</span>
                {infra.locked && (
                  <span className="infra-lock">
                    <small>{t('infraManagement.locked')}</small>
                    <Lock />
                  </span>
                )}
              </button>
              <InfraSelectorGrantsManager
                infraId={infra.id}
                userGrant={userGrant}
                resourceGrants={resourceGrants}
                userSubjectsList={usersInfraGrantsByInfraId[infra.id]}
              />
              <div className="infraslist-item-choice-footer">
                <span>ID {infra.id}</span>
                <span>RAILJSON V{infra.railjson_version}</span>
                <span>
                  V{infra.version}
                  {editoastUpToDateIndicator(infra.version, infra.generated_version)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default InfraSelectorModalBodyStandard;
