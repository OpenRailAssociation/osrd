import React, { useState } from 'react';
import nextId from 'react-id-generator';
import { FaLock, FaTrash } from 'react-icons/fa';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { Infra } from 'common/api/osrdEditoastApi';
import ActionsBar from './InfraSelectorEditionActionsBar';
import { editoastUpToDateIndicator } from './InfraSelectorModalBodyStandard';
import InfraSelectorEditionActionsBarDelete from './InfraSelectorEditionActionsBarDelete';

type InfraSelectorEditionItemProps = {
  infra: Infra;
  isFocused?: number;
  setIsFocused: (infraId?: number) => void;
};

export default function InfraSelectorEditionItem({
  infra,
  isFocused,
  setIsFocused,
}: InfraSelectorEditionItemProps) {
  const [value, setValue] = useState(infra.name);
  const [runningDelete, setRunningDelete] = useState<number | undefined>(undefined);
  const { t } = useTranslation('infraManagement');

  const handleRunningDelete = () => {
    setRunningDelete(infra.id);
  };

  return (
    <div className="infraslist-item-edition">
      {(isFocused !== undefined && isFocused !== infra.id) ||
      (runningDelete !== undefined && runningDelete !== infra.id) ? (
        <div className="infralist-item-edition-disabled" />
      ) : null}
      {runningDelete === infra.id ? (
        <InfraSelectorEditionActionsBarDelete setRunningDelete={setRunningDelete} infra={infra} />
      ) : null}
      {isFocused === infra.id ? null : (
        <button
          className="infraslist-item-action delete"
          type="button"
          title={t('infraManagement:actions.delete')}
          onClick={handleRunningDelete}
        >
          <FaTrash />
        </button>
      )}
      <div className="infraslist-item-edition-block">
        <div className="infraslist-item-edition-main">
          {isFocused === infra.id ? (
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
          inputValue={value}
        />
      </div>
    </div>
  );
}
