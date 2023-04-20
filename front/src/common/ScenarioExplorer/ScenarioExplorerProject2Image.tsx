import React, { useMemo, useState } from 'react';
import { getDocument } from 'common/api/documentApi';
import { MiniCardsImageProps } from './ScenarioExplorerTypes';

export default function Project2Image({ project }: MiniCardsImageProps) {
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

  return imageUrl ? <img src={imageUrl} alt="X" /> : null;
}
