import axios, { type ResponseType } from 'axios';

import mainConfig from 'config/config';

export const getDocument = async (documentKey: number): Promise<Blob> => {
  const config = {
    responseType: 'blob' as ResponseType,
  };
  const path = `${mainConfig.proxy_editoast}/documents/${documentKey}`;
  const res = await axios.get(path, config);
  return res.data;
};

export const postDocument = async (image: Blob) => {
  const config = {
    headers: {
      'Content-Type': image.type || 'application/octet-stream',
    },
  };
  const path = `${mainConfig.proxy_editoast}/documents`;

  const res = await axios.post(path, image, config);
  return res.data.document_key;
};
