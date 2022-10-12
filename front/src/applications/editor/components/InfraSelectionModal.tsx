import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { datetime2string } from 'utils/timeManipulation';

import { ModalProps } from '../tools/types';
import Modal from './Modal';
import { get } from '../../../common/requests';
import { addNotification, setFailure } from '../../../reducers/main';
import history from '../../../main/history';
import { useNavigate } from 'react-router';

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

const InfraSelectorModal: FC<ModalProps<{}>> = ({ submit, cancel }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation(['translation', 'osrdconf']);
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
        console.log('ERROR', e);
      });
  }, []);

  return (
    <Modal onClose={cancel} title={t('osrdconf:infrachoose')}>
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
              submit({});
            }}
            key={infra.id}
            data-dismiss="modal"
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
          <div className="d-flex align-items-center justify-content-center" style={{ width: 100 }}>
            <div className="spinner-border" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        )}
      </div>

      <div className="text-right">
        <button type="button" className="btn btn-danger mr-2" onClick={cancel}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => submit({})}
          disabled={!infras}
        >
          {t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default InfraSelectorModal;
