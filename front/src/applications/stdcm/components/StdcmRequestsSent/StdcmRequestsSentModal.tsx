import { Dialog } from '@osrd-project/ui-core';
import { LinkExternal, X } from '@osrd-project/ui-icons';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import 'dayjs/locale/fr';
import { useTranslation } from 'react-i18next';

import useStdcmRequestsSent from 'applications/stdcm/hooks/useStdcmRequestsSent';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

dayjs.extend(calendar);

type StdcmRequestsSentModalProps = {
  onClose: () => void;
};

const StdcmRequestsSentModal = ({ onClose }: StdcmRequestsSentModalProps) => {
  'use memo';

  const dispatch = useAppDispatch();
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

  const openRequestsFolder = async () => {
    try {
      if (requestsSentData().length !== 0) {
        window.open(requestsSentData()[0].created_request_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      dispatch(
        setFailure(
          castErrorToFailure(err, {
            name: t('translation:common.error'),
            message: t('header.errorRequestsFolder'),
          })
        )
      );
    }
  };

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
      headerClassname="stdcm-requests-sent-modal-header"
      bodyClassname="stdcm-requests-sent-modal-body"
      header={
        <>
          <div className="stdcm-requests-sent-modal-header-left">
            <h5>{t('requestsSentModal.title')}</h5>
            {requestsSentData().length !== 0 && (
              <button className="stdcm-requests-sent-folder-button" onClick={openRequestsFolder}>
                <LinkExternal /> {t('requestsSentModal.folder')}
              </button>
            )}
          </div>
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
