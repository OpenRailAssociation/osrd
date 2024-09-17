import { useTranslation } from 'react-i18next';

import attributionsLicenses from './json/licenses.json';

type AttributionLicense = {
  name: string;
  version: string;
  copyright: string;
  publisher: string;
  url?: string;
  license: string;
};

// Libs which are not in the package.json, so we add it statically
const DATA_SOURCES: AttributionLicense[] = [
  {
    license: 'https://geoservices.ign.fr/cgu-licences',
    publisher: 'IGN',
    copyright: '© IGN - 2021',
    version: '',
    name: 'IGN Ortho',
    url: 'https://geoservices.ign.fr/services-web-experts-ortho',
  },
  {
    license: 'https://data.sncf.com/pages/licence/#A1',
    publisher: 'SNCF',
    copyright: '',
    version: '',
    name: 'Open data SNCF',
    url: 'https://ressources.data.sncf.com/pages/accueil/',
  },
  {
    license: 'CC-BY-NC-SA 3.0',
    publisher: 'Marc Le Gad',
    copyright: '',
    version: '',
    name: 'MLG Traffic',
    url: 'http://www.mlgtraffic.net',
  },
  {
    license: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    publisher: 'Mapzen',
    copyright: '',
    version: '',
    name: 'Terrain Tiles',
    url: 'https://registry.opendata.aws/terrain-tiles/',
  },
];

type LicenseCardProps = { attribution: AttributionLicense };

const LicenseCard = ({
  attribution: { name, version, copyright, publisher, url, license },
}: LicenseCardProps) => (
  <a href={url} rel="noreferrer" target="blank">
    <h3 className="d-flex mr-1 mb-0">
      {name}
      <small className="d-flex align-items-center ml-2">
        {version}
        {url && <i className="ml-2 icons-external-link" />}
      </small>
    </h3>
    <div className="small ml-4 mb-2">
      {copyright.replace('(c)', '©') || publisher || `${name} authors`}
      {license && ` / ${license}`}
    </div>
  </a>
);

const LicenseAttributions = () => {
  const { t } = useTranslation('home/navbar');

  const attributionsArray = [...(Object.values(attributionsLicenses) as AttributionLicense[])];

  const attributions = attributionsArray
    .map((licence) => ({ ...licence, name: licence.name.replace('@', '') }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="col-md-6 h-100 d-flex flex-column">
      <h2 className="text-center mb-4">{t('informations.dataSources')}</h2>
      <div className="license-attributions">
        {DATA_SOURCES.map((dataSource) => (
          <LicenseCard attribution={dataSource} key={dataSource.name} />
        ))}
      </div>
      <h2 className="text-center my-4">{t('informations.librairies')}</h2>
      <div className="license-attributions licenses">
        {attributions.map((attribution) => (
          <LicenseCard attribution={attribution} key={attribution.name} />
        ))}
      </div>
    </div>
  );
};

export default LicenseAttributions;
