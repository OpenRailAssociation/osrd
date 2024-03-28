// React Component displaying different applications versions and license attributions
// List of applications : Editoast, Core, Api

import React from 'react';

import { useTranslation } from 'react-i18next';

import osrdLogo from 'assets/fav-osrd-color.svg';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import motriceParty from 'common/MotriceRelated/motriceParty';

import LicenseAttributions from './LicenseAttributions';

function ReleaseInformations() {
  const { t } = useTranslation('home/navbar');
  const { data: editoastVersion } = osrdEditoastApi.endpoints.getVersion.useQuery();
  const { data: coreVersion } = osrdEditoastApi.endpoints.getVersionCore.useQuery();

  const osrdWebSite = 'https://osrd.fr/';

  function serviceRow(name: string, version?: string | number | null) {
    return (
      <tr>
        <th scope="row">
          <div className="cell-inner">{name}</div>
        </th>
        <td>
          <div className="cell-inner">{version}</div>
        </td>
      </tr>
    );
  }
  return (
    <div className="informations-modal h-100">
      <ModalHeaderSNCF withCloseButton />
      <ModalBodySNCF>
        <div className="informations-modal-container">
          <div className="row h-100">
            <div className="col-md-6">
              <div className="d-flex flex-column align-items-center mb-4">
                <a
                  href={osrdWebSite}
                  className="mb-4"
                  target="_blank"
                  rel="noreferrer"
                  onMouseEnter={motriceParty}
                >
                  <img src={osrdLogo} alt="OSRD logo" width={192} />
                </a>
                <h2>OSRD</h2>
                <h3>Open Source Railway Designer</h3>
              </div>
              <table className="table table-bordered">
                <caption className="sr-only">Titre</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <div className="cell-inner">{t('informations.application')}</div>
                    </th>
                    <th scope="col" id="cellfirst-t5">
                      <div className="cell-inner">{t('informations.version')}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRow('Editoast', editoastVersion?.git_describe)}
                  {serviceRow('Core', coreVersion?.git_describe)}
                  {serviceRow('Front', import.meta.env.OSRD_GIT_DESCRIBE)}
                </tbody>
              </table>
            </div>
            <div className="col-md-6 h-100">
              <LicenseAttributions />
            </div>
          </div>
        </div>
      </ModalBodySNCF>
    </div>
  );
}

export default ReleaseInformations;
