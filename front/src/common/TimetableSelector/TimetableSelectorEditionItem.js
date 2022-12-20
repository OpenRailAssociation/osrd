import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { FaTrash } from 'react-icons/fa';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import ActionsBar from './TimetableSelectorEditionActionsBar';
import TimetableSelectorEditionActionsBarDelete from './TimetableSelectorEditionActionsBarDelete';

export default function TimetableSelectorEditionItem(props) {
  const { timetable, isFocused, setIsFocused, runningDelete, setRunningDelete, getTimetablesList } =
    props;
  const [value, setValue] = useState(timetable.name);
  const { t } = useTranslation('timetableManagement');

  const handleRunningDelete = () => {
    setRunningDelete(timetable.id);
  };

  return (
    <div className="timetableslist-item-edition">
      {(isFocused !== undefined && isFocused !== timetable.id) ||
      (runningDelete !== undefined && runningDelete !== timetable.id) ? (
        <div className="timetablelist-item-edition-disabled" />
      ) : null}
      {runningDelete === timetable.id ? (
        <TimetableSelectorEditionActionsBarDelete
          setRunningDelete={setRunningDelete}
          timetable={timetable}
          getTimetablesList={getTimetablesList}
        />
      ) : null}
      {isFocused === timetable.id ? null : (
        <button
          className="timetableslist-item-action delete"
          type="button"
          title={t('timetableManagement:actions.delete')}
          onClick={handleRunningDelete}
        >
          <FaTrash />
        </button>
      )}
      <div className="timetableslist-item-edition-block">
        <div className="timetableslist-item-edition-main">
          {isFocused === timetable.id ? (
            <span className="w-100 py-1">
              <InputSNCF
                id={nextId()}
                type="text"
                sm
                onChange={(e) => setValue(e.target.value)}
                value={value}
                focus
                selectAllOnFocus
                noMargin
              />
            </span>
          ) : (
            <span className="flex-grow-1">{timetable.name}</span>
          )}
        </div>
        <div className="timetableslist-item-edition-footer">
          <span className="">ID {timetable.id}</span>
        </div>
      </div>
      <div className="timetableslist-item-actionsbar">
        <ActionsBar
          timetable={timetable}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
          getTimetablesList={getTimetablesList}
          inputValue={value}
        />
      </div>
    </div>
  );
}

TimetableSelectorEditionItem.defaultProps = {
  isFocused: undefined,
  runningDelete: undefined,
};

TimetableSelectorEditionItem.propTypes = {
  timetable: PropTypes.object.isRequired,
  isFocused: PropTypes.number,
  setIsFocused: PropTypes.func.isRequired,
  runningDelete: PropTypes.number,
  setRunningDelete: PropTypes.func.isRequired,
  getTimetablesList: PropTypes.func.isRequired,
};
