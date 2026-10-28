import { Dialog } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import 'dayjs/locale/fr';
import { useTranslation } from 'react-i18next';

import { osrdRailwayManagerApi, type PostSendLastMinuteRequestStatusesApiResponse, type RequestStatusItem } from 'common/api/osrdRailwayManagerApi';
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

const realMock: PostSendLastMinuteRequestStatusesApiResponse = {
  ZQAV73: {
    status: 'PROCESSING' as const,
    status_message:
      '*******************Demande rejetée:délai de traitement dépassé*******************\n\n**Demande générée par LMR**',
    created_request_url:
      'https://integration-gesico.reseau.sncf.fr/Pages/Demande/VieDuSillon/VieDuSillon.aspx?idVds=1474498',
    begin_op: { secondary_code: '00', type: 'uic', uic: 87447219 },
    begin_time: '02:11:00',
    end_op: { secondary_code: '00', type: 'uic', uic: 87447144 },
    end_time: 'dqp',
    updated_at: '2026-10-25T17:04:26Z',
    created_at: '2026-10-23T15:40:25Z',
    train_start: '2026-10-23T22:00:00Z',
    id: 'ZQAV73',
  },
};

const StdcmRequestsSentModal = ({ onClose }: StdcmRequestsSentModalProps) => {
  'use memo';

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
    (Object.keys(realMock) as (keyof typeof realMock)[]).map((id) => {
      const request: RequestStatusItem = realMock[id];

      const updateDate = dayjs(request.updated_at)
        .locale(i18n.language)
        .calendar(null, calendarDays);

      const beginTime = request.begin_time.slice(0, 5)

      const endTime: string | Date =
        request.end_time !== 'dqp'
          ? request.end_time.slice(0, 5)
          : t('requestsSentModal.asap');

      const applicationDate = dayjs(request.train_start)
        .locale(i18n.language)
        .calendar(null, calendarDays);

      return (
        <tr key={`request-${id}`}>
          <td className={`stdcm-requests-color-${request.status}`} />
          <td className="stdcm-requests-id">{request.id}</td>
          <td className={`stdcm-requests-status stdcm-requests-text-color-${request.status}`}>
            {t(`requestsSentModal.statuses.${request.status}`)}
          </td>
          <td className="stdcm-requests-update-date">{updateDate}</td>
          <td>
            <div className="stdcm-requests-start-time-wrapper">
              <div className="stdcm-requests-start-time-left">
                <span className="stdcm-requests-start-time">{beginTime}</span>
                <span className="stdcm-requests-op-name">{request.begin_op.name}</span>
              </div>
              <div className="stdcm-requests-main-code">{request.begin_op.main_code}</div>
            </div>
          </td>
          <td>
            <div className="stdcm-requests-start-time-wrapper">
              <div className="stdcm-requests-start-time-left">
                <span className="stdcm-requests-start-time">{endTime}</span>
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
      {requestsHistory.length === 0 && (
        <div className="stdcm-requests-sent-no-requests">{t('requestsSentModal.noRequests')}</div>
      )}
    </Dialog>
  );
};

export default StdcmRequestsSentModal;
