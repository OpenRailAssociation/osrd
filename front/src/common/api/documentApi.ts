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
