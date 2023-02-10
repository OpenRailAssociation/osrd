import React, { useMemo, useState } from 'react';
import { PROJECTS_URI } from 'applications/operationalStudies/components/operationalStudiesConsts';
import { get } from 'common/requests';
import { MiniCardsImageProps } from './ScenarioExploratorTypes';

export default function Project2Image({ project }: MiniCardsImageProps) {
  const [imageUrl, setImageUrl] = useState<string>();

  useMemo(async () => {
    if (!project || !project.image_url) return;
    try {
      const image = await get(`${PROJECTS_URI}${project.id}/image/`, { responseType: 'blob' });
      if (image) setImageUrl(URL.createObjectURL(image));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error(error);
    }
  }, [project]);

  return imageUrl ? <img src={imageUrl} alt="X" /> : null;
}
