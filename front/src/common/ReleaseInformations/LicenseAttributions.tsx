import React from 'react';

import { useTranslation } from 'react-i18next';

import attributionsLicenses from './json/licenses.json';

type attributionsLicensesType = {
  name: string;
  version: string;
  copyright: string;
  publisher: string;
  url?: string;
  licenses: string;
};

const LicenseAttributions = () => {
  const { t } = useTranslation('home/navbar');

  // mglTraffic is not a lib from package.json, so we add it manually
  const mglTrafficAttribution: attributionsLicensesType = {
    licenses: 'CC-BY-NC-SA 3.0',
    publisher: 'Marc Le Gad',
    copyright: '',
    version: '',
    name: 'MGL Traffic',
    url: 'http://www.mlgtraffic.net',
  };

  const attributionsArray = [
    ...(Object.values(attributionsLicenses) as attributionsLicensesType[]),
    mglTrafficAttribution,
  ];

  const attributions = attributionsArray
    .map((licence) => ({ ...licence, name: licence.name.replace('@', '') }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, version, copyright, publisher, url, licenses }) => (
      <a key={name} href={url} rel="noreferrer">
        <h3 className="d-flex mr-1 mb-0">
          {name}
          <small className="d-flex align-items-center ml-2">
            {`${version}`}
            {url && <i className="ml-2 icons-external-link" />}
          </small>
        </h3>
        <div className="small ml-4 mb-2">
          {copyright.replace('(c)', '©') || publisher || `${name} authors`}
          {licenses && ` / ${licenses}`}
        </div>
      </a>
    ));

  return (
    <>
      <h2 className="text-center mt-sm-1 mb-4">{t('informations.releaseInformations')}</h2>
      <div className="license-attributions">{attributions}</div>
    </>
  );
};

export default LicenseAttributions;
