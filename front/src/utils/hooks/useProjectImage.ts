import { useEffect, useState } from 'react';

import defaultProjectImage from 'assets/defaultProjectImage/default_project_image.webp';
import { getDocument } from 'common/api/documentApi';

export const useProjectImage = (imageId?: number | null) => {
  const [imageUrl, setImageUrl] = useState<string>(defaultProjectImage);

  useEffect(() => {
    if (!imageId) {
      setImageUrl(defaultProjectImage);
      return;
    }

    let objectUrl: string | undefined;

    // as the image is stored in the database and can be fetched only through api (authentication needed),
    // the direct url can not be given to the <img /> directly. Thus the image is fetched, and a new
    // url is generated and stored in imageUrl (then used in <img />).
    const getProjectImage = async () => {
      try {
        const blob = await getDocument(imageId);

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (error) {
        console.error(error);
      }
    };

    getProjectImage();

    // We revoke the previously created object URL to prevent memory leaks
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageId]);

  return imageUrl;
};
