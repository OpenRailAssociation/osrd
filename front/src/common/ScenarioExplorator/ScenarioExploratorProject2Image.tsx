import React, { useMemo, useState } from 'react';
import { PROJECTS_URI } from 'applications/operationalStudies/components/operationalStudiesConsts';
import { get } from 'common/requests';
import { MiniCardsImageProps } from './ScenarioExploratorTypes';

function Project2Image({ project }: MiniCardsImageProps) {
  const [imageUrl, setImageUrl] = useState<string>();

  useMemo(async () => {
    if (!project || !project.image_url) return;
    const image = await get(`${PROJECTS_URI}${project.id}/image/`, { responseType: 'blob' });
    if (image) setImageUrl(URL.createObjectURL(image));
  }, [project]);

  return imageUrl ? <img src={imageUrl} alt="X" /> : null;
}

export default React.memo(Project2Image);
