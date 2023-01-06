import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/projects.svg';
import genJSON from 'applications/osrd/components/HomeContent/genJSON';
import ProjectCard from 'applications/osrd/components/HomeContent/ProjectCard';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import osrdLogo from 'assets/pictures/osrd.png';
import Loader from 'common/Loader';

export default function HomeContent() {
  const { t } = useTranslation('osrd/home');
  const [data, setData] = useState();
  const [filter, setFilter] = useState('');
  const [sortOption, setSortOption] = useState('byName');

  const sortOptions = [
    {
      label: t('sortOptions.byName'),
      value: 'byName',
    },
    {
      label: t('sortOptions.byRecentDate'),
      value: 'byRecentDate',
    },
  ];

  const handleSortOptions = (e) => {
    setSortOption(e.target.value);
    console.log(e);
  };

  useEffect(() => {
    setData(genJSON());
  }, []);

  return (
    <>
      <NavBarSNCF appName={t('projects')} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          <div className="application-title d-none">
            <img src={osrdLogo} alt="OSRD logo" />
            <h1>Open Source Railway Designer</h1>
          </div>
          <div className="projects-toolbar">
            <div className="h1 mb-0">{`${data ? data.length : 0} ${t('projectNumber')}`}</div>
            <div className="flex-grow-1">
              <InputSNCF
                type="text"
                name="projects-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('filterPlaceholder')}
                whiteBG
                noMargin
                unit={<i className="icons-search" />}
              />
            </div>
            <OptionsSNCF
              name="projects-sort-filter"
              onChange={handleSortOptions}
              selectedValue={sortOption}
              options={sortOptions}
            />
            <button className="btn btn-primary" type="button">
              <i className="icons-add" />
              <span className="ml-2">Créer un projet</span>
            </button>
          </div>
          {data ? (
            <div className="projects-list">
              <div className="row">
                {data.map((details) => (
                  <div className="col-xl-2 col-lg-3 col-md-4 col-sm-6">
                    <ProjectCard details={details} key={nextId()} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <Loader position="center" />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
