import { useCallback, useContext, useState } from 'react';

import { Lock, Search } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { Infra } from 'common/api/osrdEditoastApi';
import GrantsManager from 'common/authorization/components/GrantsManager';
import useAuthz from 'common/authorization/hooks/useAuthz';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useInfraActions, useInfraID, useOsrdContext } from 'common/osrdContext';
import { MODES } from 'main/consts';
import { deleteItinerary } from 'reducers/osrdconf/operationalStudiesConf';
import { useAppDispatch } from 'store';
import { useAsyncMemo } from 'utils/useAsyncMemo';

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
  const { userId, getUserPrivileges } = useAuthz();
  const [redraw, setRedraw] = useState(0);

  // Get the user privileges for infras
  const userPrivilegesByInfraId = useAsyncMemo(async () => {
    const data = await getUserPrivileges({ infra: infraIdsList });
    return data.infra || {};
    // redraw is in the deps to force the reload of the privileges when the user changes his own grant
  }, [getUserPrivileges, infraIdsList, redraw]);

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
        {infrasList.map((infra) => (
          <div
            key={`${JSON.stringify(infra)}-${redraw}`}
            className={cx('infraslist-item-choice', {
              locked: infra.locked,
              unlocked: !infra.locked,
              active: infra.id === infraID,
            })}
          >
            <div
              onClick={() => {
                setInfraID(infra.id);
              }}
              tabIndex={0}
              role="button"
            >
              <div className="infraslist-item-info-header">
                <span className="infraslist-item-choice-name">{infra.name}</span>
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
                userPrivileges={
                  userPrivilegesByInfraId.type === 'ready'
                    ? userPrivilegesByInfraId.data[infra.id]
                    : undefined
                }
                onChangeSuccess={(subjectId) => {
                  // In case the current user has changed his own grant, we need to redraw the list
                  // to update the grant display on each infra
                  if (subjectId === userId) setRedraw((prev) => prev + 1);
                }}
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
