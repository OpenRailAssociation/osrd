import { Dialog } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

type StdcmRequestsSentModalProps = {
  onClose: () => void;
};

type mockedRequestsHistory = {
  id: string;
  status: 'CREATED' | 'PROCESSING' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED';
  begin_op: string;
  end_op: string;
  updated_at: string;
  created_at: string;
};

const requestsHistory: mockedRequestsHistory[] = [
  {
    id: 'AA00BB',
    status: 'CREATED',
    begin_op: 'Woippy',
    end_op: 'Ébange',
    created_at: '2026-09-28T08:15:00Z',
    updated_at: '2026-09-28T08:15:00Z',
  },
  {
    id: 'LK65CV',
    status: 'PROCESSING',
    begin_op: 'Somain',
    end_op: 'Bobigny',
    created_at: '2026-09-29T10:30:00Z',
    updated_at: '2026-09-29T11:00:00Z',
  },
  {
    id: 'OP47NB',
    status: 'ACCEPTED',
    begin_op: 'Bordeaux-Hourca…',
    end_op: 'St-Jory',
    created_at: '2026-09-30T09:00:00Z',
    updated_at: '2026-10-01T14:45:00Z',
  },
];

const StdcmRequestsSentModal = ({ onClose }: StdcmRequestsSentModalProps) => {
  const { t } = useTranslation(['stdcm', 'translation']);

  const requestsSentRows = () =>
    requestsHistory.map((request, index) => (
      <tr key={`request-${index}`}>
        <td className={`stdcm-requests-color-${request.status}`} />
        <td>{request.id}</td>
        <td className={`stdcm-requests-text-color-${request.status}`}>
          {t(`requestsSentModal.statuses.${request.status}`)}
        </td>
        <td>{request.updated_at}</td>
        <td>{request.begin_op}</td>
        <td>{request.end_op}</td>
      </tr>
    ));

  return (
    <Dialog
      headerClassname="flex justify-between items-center"
      bodyClassname="stdcm-requests-sent-modal-body"
      header={
        <>
          <h5>{t('requestsSentModal.title')}</h5>
          <button type="button" onClick={onClose}>
            <X size="lg" />
          </button>
        </>
      }
      footer={null}
    >
      <div className="stdcm-requests-sent-table-container">
        <table>
          <thead>
            <tr>
              <th aria-label="status-color" />
              <th>{t('requestsSentModal.requestNumber')}</th>
              <th>{t('requestsSentModal.status')}</th>
              <th>{t('requestsSentModal.updateDate')}</th>
              <th>{t('requestsSentModal.origin')}</th>
              <th>{t('requestsSentModal.destination')}</th>
            </tr>
          </thead>
          <tbody>{requestsSentRows()}</tbody>
        </table>
      </div>
    </Dialog>
  );
};

export default StdcmRequestsSentModal;
