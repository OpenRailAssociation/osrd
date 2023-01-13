/* eslint-disable import/order */
import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { NotificationsState } from 'common/Notifications';
import OSRDSimulationConfig from './views/OSDSimulationConfig';
import OSRDSimulation from './views/OSRDSimulation/OSRDSimulation';
import HomeContent from './views/HomeContent';
import Project from './views/Project';
import Study from './views/Study';
import Scenario from './views/Scenario';

import 'applications/operationalStudies/operationalStudies.scss';

function HomeOSRD() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeContent />} />
        <Route path="/project" element={<Project />} />
        <Route path="/study" element={<Study />} />
        <Route path="/scenario" element={<Scenario />} />

        <Route path="/settings" element={<OSRDSimulationConfig />} />
        <Route path="/simulation" element={<OSRDSimulation />} />
      </Routes>
      <NotificationsState />
    </>
  );
}

export default HomeOSRD;
