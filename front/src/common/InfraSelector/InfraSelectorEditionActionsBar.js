import React from 'react';
import PropTypes from 'prop-types';
import { FaCopy, FaLock, FaLockOpen, FaPencilAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { post } from 'common/requests';
import { editoastUpToDateIndicator } from './InfraSelectorModalBodyStandard';
import { MdCancel, MdCheck } from 'react-icons/md';

const infraURL = '/editoast/infra';

export default function ActionsBar(props) {
  const { infra, isFocused, setIsFocused, setMustRefresh } = props;
  const { t } = useTranslation('infraManagement');

  async function handleLockedState(action) {
    try {
      await post(`${infraURL}/${infra.id}/${action}/`, {});
      setMustRefresh(true);
    } catch (e) {
      console.log(e);
    }
  }

  async function handleDuplicate() {
    try {
      // await duplicate infra
    } catch (e) {
      console.log(e);
    }
  }

  if (infra.locked) {
    return (
      <>
        <button
          className="infraslist-item-action unlock"
          type="button"
          title={t('infraManagement:actions.unlock')}
          onClick={() => handleLockedState('unlock')}
        >
          <FaLockOpen />
        </button>
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
        >
          <FaCopy />
        </button>
      </>
    );
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
          onClick={() => setIsFocused(undefined)}
          title={t('infraManagement:actions.check')}
        >
          <MdCheck />
        </button>
      </>
    );
  }
  return (
    <>
      <button
        className="infraslist-item-action lock"
        type="button"
        title={t('infraManagement:actions.lock')}
        onClick={() => handleLockedState('lock')}
      >
        <FaLock />
      </button>
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
      >
        <FaCopy />
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
};
