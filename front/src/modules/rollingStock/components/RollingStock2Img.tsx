import React, { useEffect, useState } from 'react';

import placeholderRollingStockElectric from 'assets/pictures/placeholder_rollingstock_elec.gif';
import placeholderRollingStockThermal from 'assets/pictures/placeholder_rollingstock_thermal.gif';
import { getDocumentUrl } from 'common/api/documentApi';
import type {
  LightRollingStockWithLiveries,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';

type RollingStock2ImgProps = {
  rollingStock: RollingStockWithLiveries | LightRollingStockWithLiveries;
};

const RollingStock2Img = ({ rollingStock }: RollingStock2ImgProps) => {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const { liveries } = rollingStock;
    if (!Array.isArray(liveries)) {
      setImageUrl('');
      return;
    }

    const defaultLivery = liveries.find((livery) => livery.name === 'default');
    const mode = Object.keys(rollingStock.effort_curves.modes)[0];
    if (!defaultLivery?.compound_image_id) {
      setImageUrl(
        rollingStock.effort_curves.modes[mode].is_electric
          ? placeholderRollingStockElectric
          : placeholderRollingStockThermal
      );
    } else {
      setImageUrl(getDocumentUrl(defaultLivery.compound_image_id));
    }
  }, [rollingStock]);

  if (!imageUrl) return null;

  return (
    <img data-testid="rolling-stock-image" src={imageUrl} alt={rollingStock?.name} loading="lazy" />
  );
};

export default React.memo(RollingStock2Img);
