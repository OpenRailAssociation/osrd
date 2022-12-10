import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { FaLock, FaTrash } from 'react-icons/fa';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { post } from 'common/requests';
import { editoastUpToDateIndicator } from './InfraSelectorModalBodyStandard';
import ActionsBar from './InfraSelectorEditionActionsBar';

export default function InfraSelectorEditionItem(props) {
  const { infra, isFocused, setIsFocused, setMustRefresh } = props;
  const [value, setValue] = useState(infra.name);
  const { t } = useTranslation('infraManagement');

  const handleChangeName = (e) => {
    setValue(e.target.value);
  };

  return (
    <div
      className={`infraslist-item-edition ${
        isFocused !== undefined && isFocused !== infra.id ? 'disabled' : ''
      }`}
    >
      <button
        className="infraslist-item-action delete"
        type="button"
        title={t('infraManagement:actions.delete')}
      >
        <FaTrash />
      </button>
      <div className="infraslist-item-edition-block">
        <div className="infraslist-item-edition-main">
          {isFocused === infra.id ? (
            <span className="w-100 py-1">
              <InputSNCF
                id={nextId()}
                type="text"
                sm
                onChange={handleChangeName}
                value={value}
                focus
                selectAllOnFocus
                noMargin
              />
            </span>
          ) : (
            <>
              <span className="flex-grow-1">{infra.name}</span>
              {infra.locked ? (
                <span className="infra-lock">
                  <small>{t('infraManagement:locked')}</small>
                  <FaLock />
                </span>
              ) : null}
            </>
          )}
        </div>
        <div className="infraslist-item-edition-footer">
          <span className="">ID {infra.id}</span>
          <span className="">RAILJSON V{infra.railjson_version}</span>
          <span className="">
            V{infra.version}
            {editoastUpToDateIndicator(infra.version, infra.generated_version)}
          </span>
        </div>
      </div>
      <div className="infraslist-item-actionsbar">
        <ActionsBar
          infra={infra}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
          setMustRefresh={setMustRefresh}
          inputValue={value}
        />
      </div>
    </div>
  );
}

InfraSelectorEditionItem.defaultProps = {
  isFocused: undefined,
};

InfraSelectorEditionItem.propTypes = {
  infra: PropTypes.object.isRequired,
  isFocused: PropTypes.number,
  setIsFocused: PropTypes.func.isRequired,
  setMustRefresh: PropTypes.func.isRequired,
};
