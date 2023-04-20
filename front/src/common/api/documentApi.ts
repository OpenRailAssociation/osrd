import axios, { ResponseType } from 'axios';
import mainConfig from 'config/config';


export const getDocument = async (documentKey: number): Promise<Blob> => {
    const config = {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        responseType: 'blob' as ResponseType,
      };
    const path = `${mainConfig.proxy_editoast}/documents/${documentKey}`;
    const res = await axios.get(path, config);
    return res.data;
};

export const postDocument = async (image: Blob) => {
  const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        "Content-Type": "multipart/form-data",
      },
    };
  const path = `${mainConfig.proxy_editoast}/documents`;

  const res = await axios.post(path, image, config);
  return res.data.document_key;
};
