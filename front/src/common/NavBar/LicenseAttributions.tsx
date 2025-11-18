import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

type AttributionLicense = {
  name: string;
  version: string;
  identifier?: string;
  text?: string;
  url?: string;
};

const COLLABORATIONS: AttributionLicense[] = [
  {
    name: 'Netzgrafik-Editor',
    version: '',
    identifier: 'Apache-2.0, © 2024 Swiss Federal Railways SBB AG',
    url: 'https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend',
  },
];

// Libs which are not in the package.json, so we add it statically
const DATA_SOURCES: AttributionLicense[] = [
  {
    name: 'IGN Ortho',
    version: '',
    identifier: '© IGN - 2021, https://geoservices.ign.fr/cgu-licences',
    url: 'https://geoservices.ign.fr/services-web-experts-ortho',
  },
  {
    name: 'Open data SNCF',
    identifier: 'https://data.sncf.com/pages/licence/#A1',
    version: '',
    url: 'https://ressources.data.sncf.com/pages/accueil/',
  },
  {
    name: 'MLG Traffic',
    identifier: 'CC-BY-NC-SA 3.0, Marc Le Gad',
    version: '',
    url: 'http://www.mlgtraffic.net',
  },
  {
    name: 'Terrain Tiles',
    identifier: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    version: '',
    url: 'https://registry.opendata.aws/terrain-tiles/',
  },
];

type LicenseCardProps = { attribution: AttributionLicense };

const LicenseCard = ({
  attribution: { name, version, text, url, identifier },
}: LicenseCardProps) => (
  <div>
    <a href={url} rel="noreferrer" target="blank">
      <h3 className="d-flex mr-1 mb-0">
        {name.replace('@', '')}
        <small className="d-flex align-items-center ml-2">
          {version}
          {url && <i className="ml-2 icons-external-link" />}
        </small>
      </h3>
    </a>
    <div className="small ml-4 mb-2">
      {identifier ?? (
        <span className="license-card-text">{text?.substring(0, 300).replace('(c)', '©')}</span>
      )}
    </div>
  </div>
);

const LicenseAttributions = () => {
  const { t } = useTranslation();

  const [licences, setLicences] = useState<AttributionLicense[]>([]);

  useEffect(() => {
    fetch('/licenses.json')
      .then((res) => res.json())
      .then((data) => setLicences(data))
      .catch((err) => console.error('Error loading licenses', err));
  }, []);

  return (
    <div className="col-md-6 h-100 d-flex flex-column">
      <h2 className="text-center mb-4">{t('nav-bar.informations.collaborations')}</h2>
      <div className="license-attributions">
        {COLLABORATIONS.map((dataSource) => (
          <LicenseCard attribution={dataSource} key={dataSource.name} />
        ))}
      </div>
      <h2 className="text-center my-4">{t('nav-bar.informations.dataSources')}</h2>
      <div className="license-attributions">
        {DATA_SOURCES.map((dataSource) => (
          <LicenseCard attribution={dataSource} key={dataSource.name} />
        ))}
      </div>
      <h2 className="text-center my-4">{t('nav-bar.informations.librairies')}</h2>
      <div className="license-attributions licenses">
        {licences.map((attribution) => (
          <LicenseCard attribution={attribution} key={attribution.name + attribution.version} />
        ))}
      </div>
    </div>
  );
};

export default LicenseAttributions;
