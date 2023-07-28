import React from 'react';
import { useTranslation } from 'react-i18next';
import Countdown from 'react-countdown';
import { Infra, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useDispatch } from 'react-redux';
import { setFailure, setSuccess } from 'reducers/main';

type InfraSelectorEditionActionsBarDeleteProps = {
  infra: Infra;
  setRunningDelete: (infraId?: number) => void;
};

export default function InfraSelectorEditionActionsBarDelete({
  infra,
  setRunningDelete,
}: InfraSelectorEditionActionsBarDeleteProps) {
  const { t } = useTranslation('infraManagement');
  const dispatch = useDispatch();

  const [deleteInfra] = osrdEditoastApi.useDeleteInfraByIdMutation();

  async function handleDeleteInfra() {
    try {
      await deleteInfra({ id: infra.id });
      setRunningDelete(undefined);
      dispatch(
        setSuccess({
          title: t('infraDeleted', { name: infra.name }),
          text: '',
        })
      );
    } catch (e) {
      if (e instanceof Error) {
        dispatch(
          setFailure({
            name: e.name,
            message: e.message,
          })
        );
      }
    }
  }

  const countDownDelete = ({ seconds, completed }: { seconds: number; completed: boolean }) => {
    if (completed) {
      return (
        <button
          type="button"
          className="infraslist-item-edition-delete-buttons yes"
          onClick={handleDeleteInfra}
        >
          {t('yes')}
        </button>
      );
    }
    return (
      <button type="button" className="infraslist-item-edition-delete-buttons almost-yes">
        {seconds}s
      </button>
    );
  };

  return (
    <div className="infraslist-item-edition-delete">
      <div className="infraslist-item-edition-delete-main">
        <div>
          <div className="small">{t('deleteConfirm')}</div>
          <div className="font-weight-bold">{infra.name}</div>
        </div>
      </div>
      <button
        type="button"
        className="infraslist-item-edition-delete-buttons no"
        onClick={() => {
          setRunningDelete(undefined);
        }}
      >
        {t('no')}
      </button>
      <Countdown date={Date.now() + 3000} renderer={countDownDelete} />
    </div>
  );
}
