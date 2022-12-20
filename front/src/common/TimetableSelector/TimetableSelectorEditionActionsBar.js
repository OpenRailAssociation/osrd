import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FaCopy, FaPencilAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { MdCancel, MdCheck } from 'react-icons/md';

export default function ActionsBar(props) {
  const { timetable, isFocused, setIsFocused, getTimetablesList, inputValue } = props;
  const { t } = useTranslation('timetableManagement');
  const [isWaiting, setIsWaiting] = useState(false);

  async function handleDuplicate() {
    if (!isWaiting) {
      setIsWaiting(true);
      try {
        // await duplicate timetable
        console.log('duplicate', timetable.id);
        getTimetablesList();
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
        // await rename timetable with inputValue
        console.log('rename', timetable.id, inputValue);
        getTimetablesList();
        setIsFocused(undefined);
        setIsWaiting(false);
      } catch (e) {
        console.log(e);
        setIsWaiting(false);
      }
    }
  }

  if (isFocused && isFocused === timetable.id) {
    return (
      <>
        <button
          className="timetableslist-item-action cancel"
          type="button"
          title={t('timetableManagement:actions.cancel')}
          onClick={() => setIsFocused(undefined)}
        >
          <MdCancel />
        </button>
        <button
          className="timetableslist-item-action check"
          type="button"
          onClick={handleRename}
          title={t('timetableManagement:actions.check')}
        >
          <MdCheck />
        </button>
      </>
    );
  }
  if (isWaiting) {
    return (
      <button
        className="timetableslist-item-action waiting disabled"
        type="button"
        title={t('timetableManagement:actions.waiting')}
      >
        <div className="spinner-border" />
      </button>
    );
  }
  return (
    <>
      <button
        className="timetableslist-item-action rename"
        type="button"
        onClick={() => setIsFocused(timetable.id)}
        title={t('timetableManagement:actions.rename')}
        data-toggle="tooltip"
      >
        <FaPencilAlt />
      </button>
      <button
        className="timetableslist-item-action copy"
        type="button"
        title={t('timetableManagement:actions.copy')}
        onClick={handleDuplicate}
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
  timetable: PropTypes.object.isRequired,
  isFocused: PropTypes.number,
  setIsFocused: PropTypes.func.isRequired,
  getTimetablesList: PropTypes.func.isRequired,
  inputValue: PropTypes.string.isRequired,
};
