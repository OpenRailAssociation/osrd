import React, {useEffect} from 'react';

import Loader from 'common/Loader';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import PropTypes from 'prop-types';
import axios from "axios";
import rabbit from 'assets/pictures/KLCW_nc_standard.png';
import { useTranslation } from 'react-i18next';

export default function StdcmRequestModal(props) {
  const { t } = useTranslation(['translation', 'osrdconf']);

  return (
    <ModalSNCF htmlID="stdcmRequestModal" onEntered={()=> {console.log("nterred")}}>
      <ModalHeaderSNCF>
        <h1>{t('osrdconf:stdcmComputation')}</h1>
        <button className="btn btn-only-icon close" type="button" data-dismiss="modal">
          <i className="icons-close" />
        </button>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="d-flex flex-column text-center">
          <div className="">
            <img src={rabbit} width="50%" />
          </div>
          <div className="p-1 text-info">
          {t('osrdconf:searchingItinerary')}
          </div>
          <div className="p-1 text-info">
          {t('osrdconf:pleaseWait')}
          </div>
          <div className="p-1">
            <div className="spinner-border" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
          <div className="text-center p-1">
            <button className="btn btn-sm btn-primary " type="button">
              {t('osrdconf:cancelRequest')}
              <span className="sr-only" aria-hidden="true">{t('osrdconf:cancelRequest')}</span>
            </button>
          </div>
        </div>
      </ModalBodySNCF>

    </ModalSNCF>
  );
}
