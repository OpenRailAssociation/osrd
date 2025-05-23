import { useState } from 'react';

import { Duplicate, Pencil, Download, Lock, Unlock } from '@osrd-project/ui-icons';
import fileDownload from 'js-file-download';
import { useTranslation } from 'react-i18next';
import { MdCancel, MdCheck } from 'react-icons/md';

import { type Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useCheckProtectedAction } from 'common/authorization/hooks/useProtectedAction';
import type { Privilege } from 'common/authorization/types';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

type ActionBarProps = {
  infra: Infra;
  isFocused?: number;
  setIsFocused: (focus?: number) => void;
  inputValue: string;
  userPrivileges?: Set<Privilege>;
};

const ActionsBar = ({
  infra,
  isFocused,
  setIsFocused,
  inputValue,
  userPrivileges = new Set(),
}: ActionBarProps) => {
  const { t } = useTranslation();
  const [isWaiting, setIsWaiting] = useState(false);
  const dispatch = useAppDispatch();
  const checkProtectedAction = useCheckProtectedAction();

  const [lockInfra] = osrdEditoastApi.endpoints.postInfraByInfraIdLock.useMutation();
  const [unlockInfra] = osrdEditoastApi.endpoints.postInfraByInfraIdUnlock.useMutation();
  const [getRailjson] = osrdEditoastApi.endpoints.getInfraByInfraIdRailjson.useLazyQuery();
  const [cloneInfra] = osrdEditoastApi.endpoints.postInfraByInfraIdClone.useMutation();
  const [updateInfra] = osrdEditoastApi.endpoints.putInfraByInfraId.useMutation();

  async function toggleLockedState() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        if (infra.locked) {
          await unlockInfra({ infraId: infra.id }).unwrap();
        } else {
          await lockInfra({ infraId: infra.id }).unwrap();
        }
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      } finally {
        setIsWaiting(false);
      }
    }
  }

  async function handleExport() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        const railjson = await getRailjson({ infraId: infra.id }).unwrap();
        fileDownload(JSON.stringify(railjson), `${infra.name}.id${infra.id}.railjson.json`);
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      } finally {
        setIsWaiting(false);
      }
    }
  }

  async function handleDuplicate() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        await cloneInfra({ infraId: infra.id, name: `${infra.name}_copy` }).unwrap();
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      } finally {
        setIsWaiting(false);
      }
    }
  }

  async function handleRename() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        await updateInfra({ infraId: infra.id, body: { name: inputValue } }).unwrap();
        setIsFocused(undefined);
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      } finally {
        setIsWaiting(false);
      }
    }
  }

  if (isFocused && isFocused === infra.id) {
    return (
      <>
        <button
          className="infraslist-item-action cancel"
          type="button"
          aria-label={t('infraManagement.actions.cancel')}
          title={t('infraManagement.actions.cancel')}
          onClick={() => setIsFocused(undefined)}
        >
          <MdCancel />
        </button>
        <button
          className="infraslist-item-action check"
          type="button"
          aria-label={t('infraManagement.actions.check')}
          title={t('infraManagement.actions.check')}
          onClick={handleRename}
        >
          <MdCheck />
        </button>
      </>
    );
  }
  if (isWaiting) {
    return (
      <button
        className="infraslist-item-action waiting disabled"
        type="button"
        aria-label={t('infraManagement.actions.waiting')}
        title={t('infraManagement.actions.waiting')}
      >
        <div className="spinner-border" />
      </button>
    );
  }

  const lockButtonTitle =
    infra.locked === true ? t('infraManagement.actions.unlock') : t('infraManagement.actions.lock');
  return (
    <>
      <button
        className="infraslist-item-action unlock"
        type="button"
        aria-label={t('infraManagement.actions.unlock')}
        title={
          userPrivileges.has('can_write') ? lockButtonTitle : t('authorization.permissionDenied')
        }
        onClick={() => checkProtectedAction(userPrivileges, ['can_write'], toggleLockedState)}
      >
        {infra.locked ? <Unlock /> : <Lock />}
      </button>
      <button
        className="infraslist-item-action rename"
        type="button"
        aria-label={t('infraManagement.actions.rename')}
        title={
          userPrivileges.has('can_write')
            ? t('infraManagement.actions.rename')
            : t('authorization.permissionDenied')
        }
        onClick={() =>
          checkProtectedAction(userPrivileges, ['can_write'], () => setIsFocused(infra.id))
        }
      >
        <Pencil />
      </button>
      <button
        className="infraslist-item-action copy"
        type="button"
        aria-label={t('infraManagement.actions.copy')}
        title={t('infraManagement.actions.copy')}
        onClick={handleDuplicate}
      >
        <Duplicate />
      </button>
      <button
        className="infraslist-item-action export"
        type="button"
        aria-label={t('infraManagement.actions.export')}
        title={t('infraManagement.actions.export')}
        onClick={handleExport}
      >
        <Download />
      </button>
    </>
  );
};

export default ActionsBar;
