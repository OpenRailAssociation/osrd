import { Dialog } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { useDateTimeLocale } from 'utils/date';

type StdcmRequestsSentModalProps = {
  onClose: () => void;
};

type mockedOP = {
  name: string;
  start_time: string | null;
  main_code: string;
};

type mockedRequestsHistory = {
  id: string;
  status: 'CREATED' | 'PROCESSING' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED';
  begin_op: mockedOP;
  end_op: mockedOP;
  updated_at: string;
  created_at: string;
  application_date: string;
};

const requestsHistory: mockedRequestsHistory[] = [
  {
    id: 'AA00BB',
    status: 'CREATED',
    begin_op: { name: 'Woippy', start_time: '2026-10-01T09:00:00Z', main_code: 'DT' },
    end_op: { name: 'Ébange', start_time: null, main_code: 'FM' },
    created_at: '2026-09-28T08:15:00Z',
    updated_at: '2026-09-28T08:15:00Z',
    application_date: '2026-09-15T07:15:00Z',
  },
  {
    id: 'LK65CV',
    status: 'PROCESSING',
    begin_op: { name: 'Somain', start_time: '2026-11-05T10:03:00Z', main_code: 'TR' },
    end_op: { name: 'Bobigny', start_time: null, main_code: 'GA' },
    created_at: '2026-09-29T10:30:00Z',
    updated_at: '2026-09-29T11:00:00Z',
    application_date: '2026-09-13T10:15:00Z',
  },
  {
    id: 'OP47NB',
    status: 'ACCEPTED',
    begin_op: {
      name: 'Villeneuve-Saint-Georges',
      start_time: '2026-12-30T11:26:00Z',
      main_code: 'TS',
    },
    end_op: { name: 'St-Jory', start_time: '2026-12-30T13:26:00Z', main_code: 'RT' },
    created_at: '2026-09-30T09:00:00Z',
    updated_at: '2026-10-01T14:45:00Z',
    application_date: '2026-11-14T13:13:00Z',
  },
];

const StdcmRequestsSentModal = ({ onClose }: StdcmRequestsSentModalProps) => {
  'use memo';

  const { t } = useTranslation(['stdcm', 'translation']);
  const dateTimeLocale = useDateTimeLocale();

  const requestsSentRows = () =>
    requestsHistory.map((request, index) => {
      const updateDate = new Date(request.updated_at);
      const beginStartTime = new Date(request.begin_op.start_time!);
      let endStartTime: string | Date = t('requestsSentModal.asap');
      if (request.end_op.start_time !== null) {
        endStartTime = new Date(request.end_op.start_time);
      }
      const applicationDate = new Date(request.application_date);

      return (
        <tr key={`request-${index}`}>
          <td className={`stdcm-requests-color-${request.status}`} />
          <td>{request.id}</td>
          <td className={`stdcm-requests-text-color-${request.status}`}>
            {t(`requestsSentModal.statuses.${request.status}`)}
          </td>
          <td>
            {updateDate.toLocaleString(dateTimeLocale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </td>
          <td>
            <div className="stdcm-requests-start-time-wrapper">
              <div className="stdcm-requests-start-time-left">
                <span className="stdcm-requests-start-time">
                  {beginStartTime.toLocaleString(dateTimeLocale, {
                    timeStyle: 'short',
                  })}
                </span>
                {request.begin_op.name}
              </div>
              <div className="stdcm-requests-main-code">{request.begin_op.main_code}</div>
            </div>
          </td>
          <td>
            <div className="stdcm-requests-start-time-wrapper">
              <div className="stdcm-requests-start-time-left">
                <span className="stdcm-requests-start-time">
                  {endStartTime instanceof Date
                    ? endStartTime.toLocaleString(dateTimeLocale, {
                        timeStyle: 'short',
                      })
                    : endStartTime}
                </span>
                {request.end_op.name}
              </div>
              <div className="stdcm-requests-main-code">{request.end_op.main_code}</div>
            </div>
          </td>
          <td>
            {applicationDate.toLocaleString(dateTimeLocale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </td>
        </tr>
      );
    });

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
              <th>{t('requestsSentModal.applicationDate')}</th>
            </tr>
          </thead>
          <tbody>{requestsSentRows()}</tbody>
        </table>
      </div>
    </Dialog>
  );
};

export default StdcmRequestsSentModal;
