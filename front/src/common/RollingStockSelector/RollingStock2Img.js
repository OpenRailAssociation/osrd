import React, { useCallback, useEffect, useState } from 'react';
import nextId from 'react-id-generator';
import PropTypes from 'prop-types';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { get } from '../requests';

function RollingStock2Img(props) {
  const { rollingStock } = props;
  // as the image is stored in the database and can be fetched only through api (authentication needed),
  // the direct url can not be given to the <img /> directly. Thus the image is fetched, and a new
  // url is generated and stored in imageUrl (then used in <img />).
  const [imageUrl, setImageUrl] = useState(null);

  const getRollingStockImage = useCallback(async () => {
    if (!rollingStock || !Array.isArray(rollingStock.liveries)) return;

    const defaultLivery = rollingStock.liveries.find((livery) => livery.name === 'default');
    if (!defaultLivery?.id) return;

    try {
      const image = await get(`/rolling_stock/${rollingStock.id}/livery/${defaultLivery.id}/`, {
        responseType: 'blob',
      });
      if (image) setImageUrl(URL.createObjectURL(image));
    } catch (e) {
      console.log(e);
    }
  }, [rollingStock]);

  useEffect(() => {
    setImageUrl(null);
    getRollingStockImage();
  }, [getRollingStockImage]);

  return imageUrl ? <LazyLoadImage src={imageUrl} alt={rollingStock?.name} key={nextId()} /> : null;
}

RollingStock2Img.defaultProps = {};

RollingStock2Img.propTypes = {
  rollingStock: PropTypes.object.isRequired,
};

const MemoRollingStock2Img = React.memo(RollingStock2Img);
export default MemoRollingStock2Img;
