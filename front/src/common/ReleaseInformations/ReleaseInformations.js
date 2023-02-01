// React Component displaying different applications versions
// List of applications : Editoast, Core, Api

import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Link } from 'react-router-dom';
import { get } from '../requests';
import osrdLogo from '../../assets/pictures/osrd.png';

function ReleaseInformations() {
  const { t } = useTranslation();
  const [editoastVersion, setCurrentEditoastVersion] = useState();
  const [coreVersion, setCurrentCoreVersion] = useState();
  const [apiVersion, setCurrentApiVersion] = useState();
  const { closeModal } = useContext(ModalContext);

  const osrdWebSite = 'https://osrd.fr/';

  const getEditoastVersion = async () => {
    const response = await get('/editoast/version/');
    setCurrentEditoastVersion(response.git_describe);
  };

  const getCoreVersion = async () => {
    const response = await get('/version/core/');
    setCurrentCoreVersion(response.git_describe);
  };

  const getApiVersion = async () => {
    const response = await get('/version/api/');
    setCurrentApiVersion(response.git_describe);
  };

  useEffect(() => {
    getEditoastVersion();
    getCoreVersion();
    getApiVersion();
  }, []);

  return (
    <>
      <ModalHeaderSNCF>
        <button type="button" className="close ml-auto" aria-label="Close" onClick={closeModal}>
          <span aria-hidden="true">&times;</span>
        </button>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="d-flex flex-column align-items-center mb-4">
          <a href={osrdWebSite} className="mb-4" target="_blank" rel="noreferrer">
            <img src={osrdLogo} alt="OSRD logo" />
          </a>
          <h2>OSRD</h2>
          <h3>Open Source Railway Designer</h3>
        </div>
        <table className="table table-bordered">
          <caption className="sr-only">Titre</caption>
          <thead>
            <tr>
              <th scope="col">
                <div className="cell-inner">{t('Application')}</div>
              </th>
              <th scope="col" id="cellfirst-t5">
                <div className="cell-inner">{t('Version')}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <div className="cell-inner">Editoast</div>
              </th>
              <td>
                <div className="cell-inner">{editoastVersion}</div>
              </td>
            </tr>
            <tr>
              <th scope="row">
                <div className="cell-inner">Core</div>
              </th>
              <td>
                <div className="cell-inner">{coreVersion}</div>
              </td>
            </tr>
            <tr>
              <th scope="row">
                <div className="cell-inner">API</div>
              </th>
              <td>
                <div className="cell-inner">{apiVersion}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </ModalBodySNCF>
    </>
  );
}

export default ReleaseInformations;
