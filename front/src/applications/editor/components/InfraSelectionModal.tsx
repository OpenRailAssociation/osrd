import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { datetime2string } from 'utils/timeManipulation';
import { useNavigate } from 'react-router';

import { useModal, Modal } from 'common/BootstrapSNCF/ModalSNCF';
import { Spinner } from 'common/Loader';
import { get } from '../../../common/requests';
import { addNotification, setFailure } from '../../../reducers/main';

const infraURL = '/infra/';
type InfrasList = {
  id: string;
  name: string;
  modified: number;
}[];

async function getInfrasList(): Promise<InfrasList> {
  const response = await get<{ results: InfrasList }>(infraURL, {});
  return response.results;
}

const InfraSelectorModal: FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const { t } = useTranslation(['translation', 'infraManagement']);
  const [infras, setInfras] = useState<InfrasList | null>(null);

  useEffect(() => {
    getInfrasList()
      .then((list) => setInfras(list))
      .catch((e) => {
        dispatch(
          setFailure({
            name: t('errorMessages.unableToRetrieveInfraList'),
            message: e.message,
          })
        );
        console.error(e);
      });
  }, [dispatch, t]);

  return (
    <Modal title={t('infraManagement:chooseInfrastructure')}>
      <div className="mb-3 osrd-config-infraselector">
        {infras?.map((infra) => (
          <div
            role="button"
            tabIndex={-1}
            onClick={() => {
              dispatch(
                addNotification({
                  type: 'info',
                  text: t('Editor.nav.infra-changed', { id: infra.id, label: infra.name }),
                })
              );
              navigate(`/editor/${infra.id}`);
            }}
            key={infra.id}
            className="osrd-config-infraselector-item mb-2"
          >
            <div className="d-flex align-items-center">
              <div className="text-primary small mr-2">{infra.id}</div>
              <div className="flex-grow-1">{infra.name}</div>
              <div className="small">{datetime2string(infra.modified)}</div>
            </div>
          </div>
        ))}
        {!infras && (
          <Spinner
            className="d-flex align-items-center justify-content-center"
            style={{ width: 100 }}
          />
        )}
      </div>

      <div className="text-right">
        <button type="button" className="btn btn-danger mr-2" onClick={closeModal}>
          {t('translation:common.cancel')}
        </button>
      </div>
    </Modal>
  );
};

export default InfraSelectorModal;
