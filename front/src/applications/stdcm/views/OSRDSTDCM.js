import React, {useEffect}  from 'react';

import { MODES } from '../../osrd/consts';
import OSRDConfig from '../../osrd/views/OSRDConfig/OSRDConfig';
import StdcmRequestModal from './StdcmRequestModal';
import { updateMode } from '../../../reducers/osrdconf';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

export default function OSRDSTDCM() {
  const { t } = useTranslation(['translation', 'osrdconf']);
  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(updateMode(MODES.stdcm))
  }, []);

  const stdcmRequest = async () => {
    try {

      const controller = new AbortController();

      const fakeRequest = new Promise((resolve, reject) => {

        const fakeTener = setTimeout(() => {
          const fakeStaticData = {}
          resolve(fakeStaticData);
        }, 3000);

        controller.signal.addEventListener("abort", () => {
          clearTimeout(fakeTener)
          reject();
        });

      });

      fakeRequest.then((result) => {
        // Update simu in redux with data;
        // Close the modal
        console.log("Accomplished Promise")
      })

      fakeRequest.catch((result) => {
        // Update simu in redux with data;
        // Close the modal
        console.log("rejected Promise")
      })

      return fakeRequest
      // When http ready, do:
      /*
      cancelTokenSource.current = axios.CancelToken.source();

      // build the request

      const { data } = await axios.get("https://yesno.wtf/api", {
        cancelToken: cancelTokenSource.current.token
      });
      */

    } catch (error) {
      console.log(error);
    }
  }

  const cancelStdcmRequest = () => {

    // when http ready
    //cancelTokenSource.current.cancel();
  };

  return (
    <>
      <OSRDConfig />
      <StdcmRequestModal />
    </>
  );
}