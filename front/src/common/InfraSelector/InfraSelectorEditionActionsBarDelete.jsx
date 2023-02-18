import React from 'react';
import PropTypes from 'prop-types';
import { deleteRequest } from 'common/requests';
import { useTranslation } from 'react-i18next';
import Countdown from 'react-countdown';
import { INFRA_URL } from './Consts';

export default function InfraSelectorEditionActionsBarDelete(props) {
  const { getInfrasList, setRunningDelete, infra } = props;
  const { t } = useTranslation('infraManagement');

  async function deleteInfra() {
    try {
      await deleteRequest(`${INFRA_URL}${infra.id}/`);
      setRunningDelete(undefined);
      getInfrasList();
    } catch (e) {
      console.log(e);
    }
  }

  const countDownDelete = ({ seconds, completed }) => {
    if (completed) {
      return (
        <button
          type="button"
          className="infraslist-item-edition-delete-buttons yes"
          onClick={deleteInfra}
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

InfraSelectorEditionActionsBarDelete.propTypes = {
  getInfrasList: PropTypes.func.isRequired,
  infra: PropTypes.object.isRequired,
  setRunningDelete: PropTypes.func.isRequired,
};
