import { useMemo, useState } from 'react';

import { getDocument } from 'common/api/documentApi';
import type { ProjectWithStudies } from 'common/api/osrdEditoastApi';

const Project2Image = ({ project }: { project: ProjectWithStudies }) => {
  const [imageUrl, setImageUrl] = useState<string>();

  useMemo(async () => {
    if (!project || !project.image) return;
    try {
      const blobImage = await getDocument(project.image as number);
      if (blobImage) setImageUrl(URL.createObjectURL(blobImage));
    } catch (error: unknown) {
      console.error(error);
    }
  }, [project]);

  return imageUrl && <img src={imageUrl} alt="X" />;
};

export default Project2Image;
