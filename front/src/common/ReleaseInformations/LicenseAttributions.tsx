import React from 'react';
import { useTranslation } from 'react-i18next';
import licenses from './json/licenses.json';

const LicenseAttributions = () => {
  const { t } = useTranslation('home/navbar');

  const attributions = Object.values(licenses).map(({ name, version, copyright, publisher }) => (
    <div className="d-flex flex-column align-items-start" key={name}>
      <div className="d-flex">
        <h3 className="mr-1">{name}</h3>
        <span className="informations-version">{`(${version})`}</span>
      </div>
      <span className="pl-4 mb-4">{copyright || publisher || `${name} authors`}</span>
    </div>
  ));

  return (
    <>
      <h2 className="d-flex justify-content-center mt-5 mb-4">
        {t('informations.releaseInformations')}
      </h2>
      {attributions}
    </>
  );
};

export default LicenseAttributions;
