import { Route, Routes } from 'react-router-dom';

import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import React from 'react';
import logo from 'assets/pictures/home/customget.svg';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { updateSimulation } from 'reducers/osrdsimulation/actions';
import convertData from 'applications/customget/components/convertData';

import CustomGET from 'applications/customget/views/CustomGET';

import './Home.scss';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import UploadFileModal from './components/uploadFileModal';

function HomeCustomGET() {
  const { t } = useTranslation(['customget', 'home/home']);
  const { openModal, closeModal } = useModal();
  const dispatch = useDispatch();

  const handleSubmit = async (file) => {
    closeModal();
    if (file) {
      dispatch(
        updateSimulation({
          trains: convertData(JSON.parse(await file.text())),
        })
      );
    }
  };

  return (
    <div className="customget-home">
      <MastNavSNCF
        items={
          <div className="mast-nav-sncf-items">
            <MastNavItemSNCF
              link="/customget/"
              linkname={t('results')}
              icon="icons-itinerary-train-station"
            />
            <li>
              <button
                type="button"
                className="mastnav-item"
                onClick={() => openModal(<UploadFileModal handleSubmit={handleSubmit} />)}
              >
                <i className="icons-add icons-size-1x5" aria-hidden="true" />
                <span className="font-weight-medium">{t('customget:uploadFile')}</span>
              </button>
            </li>
          </div>
        }
      />
      <NavBarSNCF appName={t('home/home:customget')} logo={logo} />
      <Routes>
        <Route path="" element={<CustomGET />} />
      </Routes>
    </div>
  );
}

export default HomeCustomGET;
