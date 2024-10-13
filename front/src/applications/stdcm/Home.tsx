import { Route, Routes } from 'react-router-dom';

import StdcmView from 'applications/stdcm/views/StdcmView';

export default function HomeStdcm() {
  return (
    <Routes>
      <Route path="" element={<StdcmView />} />
    </Routes>
  );
}
