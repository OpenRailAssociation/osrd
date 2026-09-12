import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import Home from 'applications/home/views/Home';
import { userHasOnlyStdcmRoles } from 'reducers/user/userSelectors';

const InitialRedirect = () => {
  const hasOnlyStdcmRoles = useSelector(userHasOnlyStdcmRoles);

  return hasOnlyStdcmRoles ? <Navigate to="stdcm" /> : <Home />;
};

export default InitialRedirect;
