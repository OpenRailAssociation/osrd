import React, { ComponentType, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get, patch } from 'common/requests';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';
import { getOrigin, getDestination, getVias, getInfraID } from 'reducers/osrdconf/selectors';

import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { setFailure, setSuccess } from 'reducers/main';
import Itinerary from './Itinerary';

// All of these should come from proper Stdcm Context
import { updateFeatureInfoClick } from 'reducers/map';
import { updateViewport } from 'reducers/map';
import { replaceVias, updateDestination, updateOrigin } from 'reducers/osrdconf';

// Initialy try to implement https://react-typescript-cheatsheet.netlify.app/docs/hoc/, no success

export default withOSRDSimulationData(Itinerary);
