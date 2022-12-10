import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FaCopy, FaDownload, FaLock, FaLockOpen, FaPencilAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { post, get } from 'common/requests';
import { MdCancel, MdCheck } from 'react-icons/md';
import fileDownload from 'js-file-download';

const infraURL = '/editoast/infra';
const infraURLOLD = '/infra';

export default function ActionsBar(props) {
  const { infra, isFocused, setIsFocused, setMustRefresh, inputValue } = props;
  const { t } = useTranslation('infraManagement');
  const [isWaiting, setIsWaiting] = useState(false);

  async function handleLockedState(action) {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        await post(`${infraURL}/${infra.id}/${action}/`, {});
        setMustRefresh(true);
        setIsWaiting(false);
      } catch (e) {
        console.log(e);
        setIsWaiting(false);
      }
    }
  }

  async function handleExport() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        const railjson = await get(`${infraURLOLD}/${infra.id}/railjson/`);
        fileDownload(JSON.stringify(railjson), `${infra.name}.id${infra.id}.railjson.json`);
        setIsWaiting(false);
      } catch (e) {
        console.log(e);
        setIsWaiting(false);
      }
    }
  }

  async function handleDuplicate() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        // await duplicate infra
        console.log('duplicate', infra.id);
        setIsWaiting(false);
      } catch (e) {
        console.log(e);
        setIsWaiting(false);
      }
    }
  }

  async function handleRename() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        // await rename infra with inputValue
        console.log('rename', infra.id, inputValue);
        setIsFocused(undefined);
        setIsWaiting(false);
      } catch (e) {
        console.log(e);
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
        className="infraslist-item-action disabled"
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
        data-toggle="tooltip"
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

ActionsBar.defaultProps = {
  isFocused: undefined,
};

ActionsBar.propTypes = {
  infra: PropTypes.object.isRequired,
  isFocused: PropTypes.number,
  setIsFocused: PropTypes.func.isRequired,
  setMustRefresh: PropTypes.func.isRequired,
  inputValue: PropTypes.string.isRequired,
};
