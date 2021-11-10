import React from 'react';
import PropTypes from 'prop-types';
import { RiMapPin2Fill, RiMapPin3Fill, RiMapPin5Fill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import setPointIti from 'applications/osrd/components/OSRDConfMap/setPointIti';

export default function PopupInfosCustomContent(props) {
  const { t } = useTranslation(['osrdconf']);
  const { data } = props;
  return (
    <div className="row">
      <div className="col-md-4">
        <div className="labelvalue w-100 mt-3">
          <span className="labelvalue-label">ID</span>
          {data.id}
        </div>
      </div>
      <div className="col-md-8">
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
      </div>
    </div>
  );
}

PopupInfosCustomContent.propTypes = {
  data: PropTypes.object.isRequired,
};
