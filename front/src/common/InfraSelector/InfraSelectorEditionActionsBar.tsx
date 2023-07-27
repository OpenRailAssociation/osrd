import React, { useState } from 'react';
import { FaCopy, FaDownload, FaLock, FaLockOpen, FaPencilAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { post, get } from 'common/requests';
import { MdCancel, MdCheck } from 'react-icons/md';
import fileDownload from 'js-file-download';
import { Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { INFRA_URL } from './Consts';

type ActionBarProps = {
  infra: Infra;
  isFocused?: number;
  setIsFocused: (focus?: number) => void;
  //   getInfrasList: () => void;
  inputValue: string;
};

export default function ActionsBar2({
  infra,
  isFocused,
  setIsFocused,
  inputValue,
}: ActionBarProps) {
  const { t } = useTranslation('infraManagement');
  const [isWaiting, setIsWaiting] = useState(false);
  const dispatch = useDispatch();

  const [cloneInfra] = osrdEditoastApi.usePostInfraByIdCloneMutation();
  const [updateInfra] = osrdEditoastApi.usePutInfraByIdMutation();

  async function handleLockedState(action: string) {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        await post(`${INFRA_URL}${infra.id}/${action}/`, {});
        // getInfrasList();
        setIsWaiting(false);
      } catch (e) {
        setIsWaiting(false);
      }
    }
  }

  async function handleExport() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        const railjson = await get(`${INFRA_URL}${infra.id}/railjson/`);
        fileDownload(JSON.stringify(railjson), `${infra.name}.id${infra.id}.railjson.json`);
        setIsWaiting(false);
      } catch (e) {
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
          title={t('infraManagement:actions.cancel')}
          onClick={() => setIsFocused(undefined)}
        >
          <MdCancel />
        </button>
        <button
          className="infraslist-item-action check"
          type="button"
          onClick={handleRename}
          title={t('infraManagement:actions.check')}
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
        title={t('infraManagement:actions.waiting')}
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
          title={t('infraManagement:actions.unlock')}
          onClick={() => handleLockedState('unlock')}
        >
          <FaLockOpen />
        </button>
      ) : (
        <button
          className="infraslist-item-action lock"
          type="button"
          title={t('infraManagement:actions.lock')}
          onClick={() => handleLockedState('lock')}
        >
          <FaLock />
        </button>
      )}
      <button
        className="infraslist-item-action rename"
        type="button"
        onClick={() => setIsFocused(infra.id)}
        title={t('infraManagement:actions.rename')}
      >
        <FaPencilAlt />
      </button>
      <button
        className="infraslist-item-action copy"
        type="button"
        title={t('infraManagement:actions.copy')}
        onClick={handleDuplicate}
      >
        <FaCopy />
      </button>
      <button
        className="infraslist-item-action export"
        type="button"
        title={t('infraManagement:actions.export')}
        onClick={handleExport}
      >
        <FaDownload />
      </button>
    </>
  );
}
