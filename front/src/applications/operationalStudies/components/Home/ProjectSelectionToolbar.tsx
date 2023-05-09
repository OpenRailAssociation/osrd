import { ProjectResult, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AiFillCheckCircle } from 'react-icons/ai';
import { FaTrash } from 'react-icons/fa';
import { MdOutlineDeselect } from 'react-icons/md';

type Props = {
  selectedProjectIds: number[];
  setSelectedProjectIds: (ids: number[]) => void;
  projectsList: ProjectResult[];
  setProjectsList: (list: ProjectResult[]) => void;
};

export default function ProjectSelectionToolbar({
  selectedProjectIds,
  setSelectedProjectIds,
  projectsList,
  setProjectsList,
}: Props) {
  const { t } = useTranslation('operationalStudies/home');
  const [deleteProject] = osrdEditoastApi.useDeleteProjectsByProjectIdMutation();

  const handleDeleteProjects = () => {
    if (selectedProjectIds.length > 0) {
      selectedProjectIds.forEach((projectId) => deleteProject({ projectId }));
      setProjectsList(
        projectsList.filter((project) => project.id && !selectedProjectIds.includes(project.id))
      );
      setSelectedProjectIds([]);
    }
  };

  return (
    <div className="projects-selection-toolbar">
      {selectedProjectIds.length > 0 && (
        <>
          <AiFillCheckCircle />
          <span className="ml-0">
            {t('selectedProjects', { count: selectedProjectIds.length })}
          </span>
          <button
            className="btn btn-sm btn-secondary"
            type="button"
            onClick={() => setSelectedProjectIds([])}
          >
            <MdOutlineDeselect />
            <span className="ml-2">{t('unselectAllProjects')}</span>
          </button>
          <button className="btn btn-sm btn-danger" type="button" onClick={handleDeleteProjects}>
            <FaTrash />
            <span className="ml-2">{t('deleteProjects')}</span>
          </button>
        </>
      )}
    </div>
  );
}
