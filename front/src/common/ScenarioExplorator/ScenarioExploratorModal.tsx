import React, { useEffect, useState } from 'react';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import scenarioExploratorLogo from 'assets/pictures/views/scenarioExplorator.svg';
import projectsLogo from 'assets/pictures/views/projects.svg';
import studiesLogo from 'assets/pictures/views/studies.svg';
import scenariosLogo from 'assets/pictures/views/scenarios.svg';
import {
  PROJECTS_URI,
  SCENARIOS_URI,
  STUDIES_URI,
} from 'applications/operationalStudies/components/operationalStudiesConsts';
import {
  projectTypes,
  studyTypes,
  scenarioTypes,
} from 'applications/operationalStudies/components/operationalStudiesTypes';
import { useTranslation } from 'react-i18next';
import { MdArrowRight } from 'react-icons/md';
import { get } from 'common/requests';

type SelectedIDsTypes = {
  project?: number;
  study?: number;
  scenario?: number;
};
const SelectedIDsDefault = {
  project: undefined,
  study: undefined,
  scenario: undefined,
};
type FilterParams = {
  name?: string;
  description?: string;
  tags?: string;
  ordering?: string;
};
type ProjectProps = {
  details: projectTypes;
};

function ProjectMiniCard({ details }: ProjectProps) {
  const [imageUrl, setImageUrl] = useState<string>();

  const getProjectImage = async (url: string) => {
    const image = await get(url, { responseType: 'blob' });
    setImageUrl(URL.createObjectURL(image));
  };

  useEffect(() => {
    if (details.image_url) {
      getProjectImage(`${PROJECTS_URI}${details.id}/image/`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);

  return (
    <div className="scenario-explorator-modal-part-itemslist-projectminicard">
      <div className="scenario-explorator-modal-part-itemslist-projectminicard-img">
        {imageUrl && <img src={imageUrl} alt="project miniature" />}
      </div>
      <div>{details.name}</div>
    </div>
  );
}

export default function ScenarioExploratorModal() {
  const { t } = useTranslation('common/scenarioExplorator');
  const [selectedIDs, setSelectedIDs] = useState<SelectedIDsTypes>(SelectedIDsDefault);
  const [projectsList, setProjectsList] = useState<projectTypes[]>();
  const [studiesList, setStudiesList] = useState<studyTypes[]>();
  const [scenariosList, setScenariosList] = useState<scenarioTypes[]>();

  const grabItemsList = async (url: string, params?: FilterParams) => {
    try {
      const data = await get(url, { params });
      setProjectsList(data.results);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    grabItemsList(PROJECTS_URI, { ordering: 'name' });
  }, []);

  return (
    <div className="scenario-explorator-modal">
      <ModalHeaderSNCF withCloseButton>
        <h1 className="scenario-explorator-modal-title">
          <img src={scenarioExploratorLogo} alt="Scenario explorator Logo" />
          {t('scenarioExplorator')}
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="row">
          <div className="col-lg-4">
            <div className="scenario-explorator-modal-part projects">
              <div className="scenario-explorator-modal-part-title">
                <img src={projectsLogo} alt="projects logo" />
                <h2>{t('projects')}</h2>
              </div>
              <div className="scenario-explorator-modal-part-itemslist">
                {projectsList &&
                  projectsList.map((project) => <ProjectMiniCard details={project} />)}
              </div>
              <div className="scenario-explorator-modal-part-arrow">
                <MdArrowRight />
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="scenario-explorator-modal-part studies">
              <div className="scenario-explorator-modal-part-title">
                <img src={studiesLogo} alt="studies logo" />
                <h2>{t('studies')}</h2>
              </div>
              <div className="scenario-explorator-modal-part-arrow">
                <MdArrowRight />
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="scenario-explorator-modal-part scenarios">
              <div className="scenario-explorator-modal-part-title">
                <img src={scenariosLogo} alt="scenarios logo" />
                <h2>{t('scenarios')}</h2>
              </div>
            </div>
          </div>
        </div>
      </ModalBodySNCF>
    </div>
  );
}
