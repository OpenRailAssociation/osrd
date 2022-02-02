import React from 'react';
import PropTypes from 'prop-types';
import { RiMapPin2Fill, RiMapPin3Fill, RiMapPin5Fill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import setPointIti from 'applications/osrd/components/OSRDConfMap/setPointIti';

export default function PopupInfosCustomContent(props) {
  const { t } = useTranslation(['osrdconf']);
  const { data } = props;
  return (
    <>
      <div className="mr-2 small text-center mb-2">
        {data.line_name && data.line_name}
        {data.ch_long_label && data.ch_long_label}
      </div>
      <button className="btn btn-sm btn-block btn-success" type="button" onClick={() => setPointIti('start', data)}>
        <RiMapPin2Fill />
        <span className="ml-1">{t('origin')}</span>
      </button>
      <button className="btn btn-sm btn-block btn-info" type="button" onClick={() => setPointIti('via', data)}>
        <RiMapPin3Fill />
        <span className="ml-1">{t('via')}</span>
      </button>
      <button className="btn btn-sm btn-block btn-warning" type="button" onClick={() => setPointIti('end', data)}>
        <RiMapPin5Fill />
        <span className="ml-1">{t('destination')}</span>
      </button>
    </>
  );
}

PopupInfosCustomContent.propTypes = {
  data: PropTypes.object.isRequired,
};
