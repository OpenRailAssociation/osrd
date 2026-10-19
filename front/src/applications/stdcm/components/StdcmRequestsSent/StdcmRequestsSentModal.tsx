import { Dialog } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import 'dayjs/locale/fr';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useDateTimeLocale } from 'utils/date';

dayjs.extend(calendar);

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
    updated_at: '2026-10-14T08:15:00Z',
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

  const { data, isLoading } = osrdEditoastApi.endpoints.getStdcmRequests.useQuery({
    by: 'user',
  });

  console.debug(data);

  const { t, i18n } = useTranslation(['stdcm', 'translation']);
  const dateTimeLocale = useDateTimeLocale();

  const calendarDays = {
    sameDay: t('requestsSentModal.calendar.sameDay'),
    nextDay: t('requestsSentModal.calendar.nextDay'),
    nextWeek: t('requestsSentModal.calendar.nextWeek'),
    lastDay: t('requestsSentModal.calendar.lastDay'),
    lastWeek: t('requestsSentModal.calendar.lastWeek'),
    sameElse: t('requestsSentModal.calendar.sameElse'),
  };

  const requestsSentRows = () =>
    requestsHistory.map((request, index) => {
      const updateDate = dayjs(request.updated_at)
        .locale(i18n.language)
        .calendar(null, calendarDays);

      const beginStartTime = new Date(request.begin_op.start_time!).toLocaleString(dateTimeLocale, {
        timeStyle: 'short',
      });

      const endStartTime: string | Date =
        request.end_op.start_time !== null
          ? new Date(request.end_op.start_time).toLocaleString(dateTimeLocale, {
              timeStyle: 'short',
            })
          : t('requestsSentModal.asap');

      const applicationDate = dayjs(request.application_date)
        .locale(i18n.language)
        .calendar(null, calendarDays);

      return (
        <tr key={`request-${index}`}>
          <td className={`stdcm-requests-color-${request.status}`} />
          <td className="stdcm-requests-id">{request.id}</td>
          <td className={`stdcm-requests-status stdcm-requests-text-color-${request.status}`}>
            {t(`requestsSentModal.statuses.${request.status}`)}
          </td>
          <td className="stdcm-requests-update-date">{updateDate}</td>
          <td>
            <div className="stdcm-requests-start-time-wrapper">
              <div className="stdcm-requests-start-time-left">
                <span className="stdcm-requests-start-time">{beginStartTime}</span>
                <span className="stdcm-requests-op-name">{request.begin_op.name}</span>
              </div>
              <div className="stdcm-requests-main-code">{request.begin_op.main_code}</div>
            </div>
          </td>
          <td>
            <div className="stdcm-requests-start-time-wrapper">
              <div className="stdcm-requests-start-time-left">
                <span className="stdcm-requests-start-time">{endStartTime}</span>
                <span className="stdcm-requests-op-name">{request.end_op.name}</span>
              </div>
              <div className="stdcm-requests-main-code">{request.end_op.main_code}</div>
            </div>
          </td>
          <td className="stdcm-requests-application-date">{applicationDate}</td>
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
      footerClassname="stdcm-requests-sent-modal-footer"
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
      {!isLoading && requestsHistory.length === 0 && (
        <div className="stdcm-requests-sent-no-requests">{t('requestsSentModal.noRequests')}</div>
      )}
      {isLoading && (
        <div className="stdcm-requests-sent-loading">
          <div className="stdcm-requests-sent-loader" />
          <div className="stdcm-requests-sent-loading-message">
            {t('requestsSentModal.loading')}
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default StdcmRequestsSentModal;
