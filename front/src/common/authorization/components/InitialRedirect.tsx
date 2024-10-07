import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import Home from 'main/home';
import { getIsStdcmProfile } from 'reducers/user/userSelectors';

const InitialRedirect = () => {
  const isStdcmProfile = useSelector(getIsStdcmProfile);

  return isStdcmProfile ? <Navigate to="stdcm" /> : <Home />;
};

export default InitialRedirect;
