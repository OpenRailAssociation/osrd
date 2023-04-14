import React, { useEffect, useState } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { LightRollingStock, RollingStock } from 'common/api/osrdEditoastApi';
import { getDocument } from 'common/api/documentApi';

const RollingStock2Img: React.FC<{ rollingStock: RollingStock | LightRollingStock }> = ({
  rollingStock,
}) => {
  // as the image is stored in the database and can be fetched only through api (authentication needed),
  // the direct url can not be given to the <img /> directly. Thus the image is fetched, and a new
  // url is generated and stored in imageUrl (then used in <img />).
  const [imageUrl, setImageUrl] = useState('');

  const getRollingStockImage = async () => {
    const { liveries } = rollingStock;
    if (!rollingStock || !Array.isArray(liveries)) return;

    const defaultLivery = liveries.find((livery) => livery.name === 'default');
    if (!defaultLivery?.compound_image_id) return;

    try {
      const image = await getDocument(defaultLivery.compound_image_id);
      if (image) setImageUrl(URL.createObjectURL(image));
    } catch (e: unknown) {
      console.error(e instanceof Error ? e.message : e);
    }
  };

  useEffect(() => {
    setImageUrl('');
    getRollingStockImage();
  }, [rollingStock]);

  return imageUrl ? <LazyLoadImage src={imageUrl} alt={rollingStock?.name} /> : null;
};

const MemoRollingStock2Img = React.memo(RollingStock2Img);
export default MemoRollingStock2Img;
