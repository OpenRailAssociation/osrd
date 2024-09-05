import { useState } from 'react';

import { Lock, Trash } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { Infra } from 'common/api/osrdEditoastApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

import ActionsBar from './InfraSelectorEditionActionsBar';
import InfraSelectorEditionActionsBarDelete from './InfraSelectorEditionActionsBarDelete';
import { editoastUpToDateIndicator } from './InfraSelectorModalBodyStandard';

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
  const [runningDelete, setRunningDelete] = useState(false);
  const { t } = useTranslation('infraManagement');

  return (
    <div className="infraslist-item-edition">
      {runningDelete ? (
        <InfraSelectorEditionActionsBarDelete setRunningDelete={setRunningDelete} infra={infra} />
      ) : (
        <>
          {isFocused !== infra.id && (
            <button
              className="infraslist-item-action delete"
              type="button"
              aria-label={t('infraManagement:actions.delete')}
              title={t('infraManagement:actions.delete')}
              onClick={() => setRunningDelete(true)}
            >
              <Trash />
            </button>
          )}
          <div className="infraslist-item-edition-block">
            <div className="infraslist-item-edition-main">
              {isFocused === infra.id ? (
                <span className="w-100 py-1">
                  <InputSNCF
                    id={`name-infra-${infra.id}`}
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
                  {infra.locked && (
                    <span className="infra-lock">
                      <small>{t('infraManagement:locked')}</small>
                      <Lock />
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="infraslist-item-edition-footer">
              <span>ID {infra.id}</span>
              <span>RAILJSON V{infra.railjson_version}</span>
              <span>
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
        </>
      )}
    </div>
  );
}
