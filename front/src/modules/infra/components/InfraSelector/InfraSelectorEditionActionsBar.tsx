import React, { useState } from 'react';

import { Duplicate, Pencil, Download, Lock, Unlock } from '@osrd-project/ui-icons';
import fileDownload from 'js-file-download';
import { useTranslation } from 'react-i18next';
import { MdCancel, MdCheck } from 'react-icons/md';

import { type Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import InfraLockState from 'modules/infra/consts';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

type ActionBarProps = {
  infra: Infra;
  isFocused?: number;
  setIsFocused: (focus?: number) => void;
  inputValue: string;
};

export default function ActionsBar({ infra, isFocused, setIsFocused, inputValue }: ActionBarProps) {
  const { t } = useTranslation('infraManagement');
  const [isWaiting, setIsWaiting] = useState(false);
  const dispatch = useAppDispatch();

  const [lockInfra] = osrdEditoastApi.endpoints.postInfraByIdLock.useMutation();
  const [unlockInfra] = osrdEditoastApi.endpoints.postInfraByIdUnlock.useMutation();
  const [getRailjson] = osrdEditoastApi.endpoints.getInfraByIdRailjson.useLazyQuery();
  const [cloneInfra] = osrdEditoastApi.endpoints.postInfraByIdClone.useMutation();
  const [updateInfra] = osrdEditoastApi.endpoints.putInfraById.useMutation();

  async function handleLockedState(action: InfraLockState) {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        if (action === InfraLockState.LOCK) {
          await lockInfra({ id: infra.id });
        }
        if (action === InfraLockState.UNLOCK) {
          await unlockInfra({ id: infra.id });
        }
      } catch (e) {
        if (e instanceof Error) {
          dispatch(setFailure(castErrorToFailure(e)));
        }
      } finally {
        setIsWaiting(false);
      }
    }
  }

  async function handleExport() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        const railjson = await getRailjson({ id: infra.id });
        fileDownload(JSON.stringify(railjson.data), `${infra.name}.id${infra.id}.railjson.json`);
      } catch (e) {
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: e.message,
            })
          );
        }
      } finally {
        setIsWaiting(false);
      }
    }
  }

  async function handleDuplicate() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        await cloneInfra({ id: infra.id, name: `${infra.name}_copy` });
      } catch (e) {
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: e.message,
            })
          );
        }
      } finally {
        setIsWaiting(false);
      }
    }
  }

  async function handleRename() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        await updateInfra({ id: infra.id, body: { name: inputValue } });
        setIsFocused(undefined);
      } catch (e) {
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: e.message,
            })
          );
        }
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
          aria-label={t('actions.cancel')}
          title={t('actions.cancel')}
          onClick={() => setIsFocused(undefined)}
        >
          <MdCancel />
        </button>
        <button
          className="infraslist-item-action check"
          type="button"
          aria-label={t('actions.check')}
          title={t('actions.check')}
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
        aria-label={t('actions.waiting')}
        title={t('actions.waiting')}
      >
        <div className="spinner-border" />
      </button>
    );
  }
  return (
    <>
      {infra.locked ? (
        <button
          className="infraslist-item-action unlock"
          type="button"
          aria-label={t('actions.unlock')}
          title={t('actions.unlock')}
          onClick={() => handleLockedState(InfraLockState.UNLOCK)}
        >
          <Unlock />
        </button>
      ) : (
        <button
          className="infraslist-item-action lock"
          type="button"
          aria-label={t('actions.lock')}
          title={t('actions.lock')}
          onClick={() => handleLockedState(InfraLockState.LOCK)}
        >
          <Lock />
        </button>
      )}
      <button
        className="infraslist-item-action rename"
        type="button"
        aria-label={t('actions.rename')}
        title={t('actions.rename')}
        onClick={() => setIsFocused(infra.id)}
      >
        <Pencil />
      </button>
      <button
        className="infraslist-item-action copy"
        type="button"
        aria-label={t('actions.copy')}
        title={t('actions.copy')}
        onClick={handleDuplicate}
      >
        <Duplicate />
      </button>
      <button
        className="infraslist-item-action export"
        type="button"
        aria-label={t('actions.export')}
        title={t('actions.export')}
        onClick={handleExport}
      >
        <Download />
      </button>
    </>
  );
}
