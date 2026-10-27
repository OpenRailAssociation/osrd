import { useCallback, useContext } from 'react';

import { Lock, Search } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { Infra } from 'common/api/osrdEditoastApi';
import GrantsManager from 'common/authorization/components/GrantsManager';
import useAuthz from 'common/authorization/hooks/useAuthz';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useInfraActions, useInfraID } from 'common/osrdContext';
import useFitViewportToInfra from 'modules/infra/useFitViewportToInfra';
import { useAppDispatch } from 'store';
import { getAsyncMemoData, useRefreshableAsyncMemo } from 'utils/useAsyncMemo';

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
  const { updateInfraID } = useInfraActions();
  const infraID = useInfraID();
  const { closeModal } = useContext(ModalContext);
  const navigate = useNavigate();
  const { getUserPrivileges } = useAuthz();
  const fitViewportToInfra = useFitViewportToInfra();

  // Get the user privileges for infras
  const { refresh: userPrivilegesRefresh, data: userPrivilegesByInfraId } = useRefreshableAsyncMemo(
    async (controller) => {
      const data = await getUserPrivileges({ infra: infraIdsList }, controller.signal);
      return data.infra || {};
    },
    [getUserPrivileges, infraIdsList]
  );

  const changeInfrastructure = useCallback(
    async (id: number) => {
      dispatch(updateInfraID(id));
      await fitViewportToInfra(id);
      if (isInEditor) {
        navigate(`/editor/${id}`);
      }
      if (!onlySelectionMode) {
        closeModal();
      }
    },
    [
      isInEditor,
      closeModal,
      navigate,
      fitViewportToInfra,
      onlySelectionMode,
      dispatch,
      updateInfraID,
    ]
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
        {infrasList.map((infra) => (
          <div
            key={`${infra.id}`}
            className={cx('infraslist-item-choice', {
              locked: infra.locked,
              unlocked: !infra.locked,
              active: infra.id === infraID,
            })}
          >
            <div
              onClick={() => {
                changeInfrastructure(infra.id);
              }}
              tabIndex={0}
              role="button"
            >
              <div className="infraslist-item-info-header">
                <span
                  className="infraslist-item-choice-name"
                  data-testid={infra.id === infraID ? 'selected-infra-name' : undefined}
                >
                  {infra.name}
                </span>
                {infra.locked && (
                  <span className="infra-lock">
                    <small>{t('infraManagement.locked')}</small>
                    <Lock />
                  </span>
                )}
              </div>
              <GrantsManager
                resourceId={infra.id}
                resourceType="infra"
                userPrivileges={getAsyncMemoData(userPrivilegesByInfraId)?.[infra.id]}
                onChangeSuccess={userPrivilegesRefresh}
              />
            </div>
            <div className="infraslist-item-choice-footer">
              <span>ID {infra.id}</span>
              <span>RAILJSON V{infra.railjson_version}</span>
              <span>
                V{infra.version}
                {editoastUpToDateIndicator(infra.version, infra.generated_version)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default InfraSelectorModalBodyStandard;
