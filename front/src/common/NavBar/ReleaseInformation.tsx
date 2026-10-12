// React Component displaying different applications versions and license attributions
// List of applications : Editoast, Core, Api

import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import motriceParty from 'common/MotriceRelated/motriceParty';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import LicenseAttributions from './LicenseAttributions';
import { Check, Copy } from "@osrd-project/ui-icons";
import { useEffect, useState } from "react";

function ServiceRow({
  name,
  version,
}: {
  name: string;
  version?: string | number | null;
}) {
  const [copied, setCopied] = useState(false);

  const versionText = version?.toString();

  async function copyTextToClipboard() {
    if (versionText) {
      try {
        await navigator.clipboard.writeText(versionText);
        setCopied(true);
      } catch (e) {
        console.error("Failed to copy text: ", e);
      }
    }
  }

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => {
      setCopied(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <tr>
      <th scope="row">
        <div className="cell-inner">
          <span title={name}>{name}</span>
        </div>
      </th>
      <td>
        {versionText && (
          <button
            title={versionText}
            className="app-version"
            onClick={copyTextToClipboard}
          >
            <code title={versionText}>{version}</code>
            {copied ? (
              <Check className="copy-icon" />
            ) : (
              <Copy className="copy-icon" />
            )}
          </button>
        )}
      </td>
    </tr>
  );
}

const ReleaseInformation = () => {
  const { t } = useTranslation();
  const deploymentSettings = useDeploymentSettings();
  const { data: editoastVersion } =
    osrdEditoastApi.endpoints.getVersion.useQuery();

  const osrdWebSite = "https://osrd.fr/";

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
                  rel="noopener noreferrer"
                  onMouseEnter={motriceParty}
                >
                  <img
                    src={deploymentSettings?.operationalStudiesLogo}
                    alt="OSRD logo"
                    width={192}
                  />
                </a>
                <h2>OSRD</h2>
                <h3>Open Source Railway Designer</h3>
              </div>
              <table className="table table-bordered">
                <caption className="sr-only">Titre</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <div className="cell-inner">{t('nav-bar.information.application')}</div>
                    </th>
                    <th scope="col">
                      <div className="cell-inner">{t('nav-bar.information.version')}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <ServiceRow
                    name="Editoast"
                    version={editoastVersion?.git_describe}
                  />
                  <ServiceRow
                    name="Front"
                    version={import.meta.env.VITE_OSRD_GIT_DESCRIBE}
                  />
                </tbody>
              </table>
            </div>
            <LicenseAttributions />
          </div>
        </div>
      </ModalBodySNCF>
    </div>
  );
};

export default ReleaseInformation;
