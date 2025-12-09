import { useTranslation } from 'react-i18next';

import { useProjectImage } from 'utils/hooks/useProjectImage';

const Project2Image = ({ imageId }: { imageId: number | null | undefined }) => {
  const { t } = useTranslation('operational-studies');
  const imageUrl = useProjectImage(imageId);

  return <img src={imageUrl} alt={t('project.projectImage')} />;
};

export default Project2Image;
