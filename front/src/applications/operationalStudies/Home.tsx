/* eslint-disable import/order */
import React from 'react';
import { Route, Routes } from 'react-router-dom';

import HomeContent from './views/HomeContent';
import Project from './views/Project';
import Study from './views/Study';
import Scenario from './views/Scenario';

function HomeOSRD() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeContent />} />
        <Route path="/project" element={<Project />} />
        <Route path="/study" element={<Study />} />
        <Route path="/scenario" element={<Scenario />} />
      </Routes>
    </>
  );
}

export default HomeOSRD;
