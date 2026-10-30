import { Dialog } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import 'dayjs/locale/fr';
import { useTranslation } from 'react-i18next';

import useStdcmRequestsSent from 'applications/stdcm/hooks/useStdcmRequestsSent';

dayjs.extend(calendar);

type StdcmRequestsSentModalProps = {
  onClose: () => void;
};

const StdcmRequestsSentModal = ({ onClose }: StdcmRequestsSentModalProps) => {
  'use memo';

  const { t, i18n } = useTranslation(['stdcm', 'translation']);

  const calendarDays = {
    sameDay: t('requestsSentModal.calendar.sameDay'),
    nextDay: t('requestsSentModal.calendar.nextDay'),
    nextWeek: t('requestsSentModal.calendar.nextWeek'),
    lastDay: t('requestsSentModal.calendar.lastDay'),
    lastWeek: t('requestsSentModal.calendar.lastWeek'),
    sameElse: t('requestsSentModal.calendar.sameElse'),
  };

  const { requestsSentData } = useStdcmRequestsSent();

  const requestsSentRows = () =>
    requestsSentData().map((request, index) => {
      const updateDate = dayjs(request.updated_at)
        .locale(i18n.language)
        .calendar(null, calendarDays);

      const endStartTime: string =
        request.end_time && request.end_time !== 'dqp'
          ? request.end_time.slice(0, 5)
          : t('requestsSentModal.asap');

      const applicationDate = dayjs(request.train_start)
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
                <span className="stdcm-requests-start-time">{request.begin_time?.slice(0, 5)}</span>
                <span className="stdcm-requests-op-name">{request.matchedBeginOp?.name}</span>
              </div>
              <div className="stdcm-requests-main-code">{request.matchedBeginOp?.main_code}</div>
            </div>
          </td>
          <td>
            <div className="stdcm-requests-start-time-wrapper">
              <div className="stdcm-requests-start-time-left">
                <span className="stdcm-requests-start-time">{endStartTime}</span>
                <span className="stdcm-requests-op-name">{request.matchedEndOp?.name}</span>
              </div>
              <div className="stdcm-requests-main-code">{request.matchedEndOp?.main_code}</div>
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
      {requestsSentData().length === 0 && (
        <div className="stdcm-requests-sent-no-requests">{t('requestsSentModal.noRequests')}</div>
      )}
    </Dialog>
  );
};

export default StdcmRequestsSentModal;
