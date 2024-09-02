import { Route, Routes } from 'react-router-dom';

import StdcmViewV2 from 'applications/stdcmV2/views/StdcmViewV2';

export default function HomeStdcm() {
  return (
    <Routes>
      <Route path="" element={<StdcmViewV2 />} />
    </Routes>
  );
}
