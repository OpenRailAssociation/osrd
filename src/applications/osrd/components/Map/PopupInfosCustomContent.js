import React from 'react';
import PropTypes from 'prop-types';
import { RiMapPin2Fill, RiMapPin3Fill, RiMapPin5Fill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import setPointIti from 'applications/osrd/components/Map/setPointIti';

export default function PopupInfosCustomContent(props) {
  const { t } = useTranslation(['osrdconf']);
  const { data } = props;
  return (
    <>
      {data.idGaia && (
        <>
          <div className="labelvalue w-100 mt-3">
            <span className="labelvalue-label">idGAIA</span>
            {data.idGaia}
          </div>
          <div className="labelvalue w-100">
            <span className="labelvalue-label">GPS</span>
            {data.clickLngLat.join(' / ')}
          </div>
          <div className="labelvalue w-100 mb-3">
            <span className="labelvalue-label">Entity</span>
            {data.id}
          </div>
        </>
      )}
      <div className="d-flex my-1">
        <button className="btn btn-success flex-fill" type="button" onClick={() => setPointIti('start', data)}>
          <RiMapPin2Fill />
          <span className="ml-1">{t('origin')}</span>
        </button>
        <button className="btn btn-info flex-fill mx-1" type="button" onClick={() => setPointIti('via', data)}>
          <RiMapPin3Fill />
          <span className="ml-1">{t('via')}</span>
        </button>
        <button className="btn btn-warning flex-fill" type="button" onClick={() => setPointIti('end', data)}>
          <RiMapPin5Fill />
          <span className="ml-1">{t('destination')}</span>
        </button>
      </div>
    </>
  );
}

PopupInfosCustomContent.propTypes = {
  data: PropTypes.object.isRequired,
};
