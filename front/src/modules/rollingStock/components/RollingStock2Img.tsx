import React, { useEffect, useState } from 'react';

import placeholderRollingStockElectric from 'assets/pictures/placeholder_rollingstock_elec.gif';
import placeholderRollingStockThermal from 'assets/pictures/placeholder_rollingstock_thermal.gif';
import { getDocument } from 'common/api/documentApi';
import type {
  LightRollingStockWithLiveries,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';

type RollingStock2ImgProps = {
  rollingStock: RollingStockWithLiveries | LightRollingStockWithLiveries;
};

const RollingStock2Img = ({ rollingStock }: RollingStock2ImgProps) => {
  // as the image is stored in the database and can be fetched only through api (authentication needed),
  // the direct url can not be given to the <img /> directly. Thus the image is fetched, and a new
  // url is generated and stored in imageUrl (then used in <img />).
  const [imageUrl, setImageUrl] = useState('');

  const getRollingStockImage = async () => {
    const { liveries } = rollingStock;
    if (!rollingStock || !Array.isArray(liveries)) return;

    const defaultLivery = liveries.find((livery) => livery.name === 'default');
    const mode = Object.keys(rollingStock.effort_curves.modes)[0];
    if (!defaultLivery?.compound_image_id) {
      setImageUrl(
        rollingStock.effort_curves.modes[mode].is_electric
          ? placeholderRollingStockElectric
          : placeholderRollingStockThermal
      );
      return;
    }

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

  return <img src={imageUrl || ''} alt={rollingStock?.name || 'defaultImg'} loading="lazy" />;
};

export default React.memo(RollingStock2Img);
