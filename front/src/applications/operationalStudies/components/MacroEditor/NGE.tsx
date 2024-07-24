import React, { useEffect, useRef } from 'react';

/* eslint-disable import/extensions, import/no-unresolved */
import ngeMain from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/main.js?url';
import ngePolyfills from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/polyfills.js?url';
import ngeRuntime from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/runtime.js?url';
import ngeStyles from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/styles.css?url';
import ngeVendor from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/vendor.js?url';
/* eslint-enable import/extensions, import/no-unresolved */
import { generatedEditoastApi, type Distribution, type TrainScheduleBase } from 'common/api/generatedEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { useSelector } from 'react-redux';
import type { TrainrunSection, TrainrunSectionOperation } from './type';

const frameSrc = `
<!DOCTYPE html>
<html class="sbb-lean sbb-light">
  <head>
    <link rel="stylesheet" href="${ngeStyles}"></link>
    <script type="module" src="${ngeRuntime}"></script>
    <script type="module" src="${ngePolyfills}"></script>
    <script type="module" src="${ngeVendor}"></script>
    <script type="module" src="${ngeMain}"></script>
  </head>
  <body></body>
</html>
`;

const NGE = () => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postV2TimetableByIdTrainSchedule.useMutation();
  const [deleteTrainSchedules] =
    osrdEditoastApi.endpoints.deleteV2TrainSchedule.useMutation();
  
  const { getTimetableID } = useOsrdConfSelectors();
  const timetableId = useSelector(getTimetableID);

  const createTrainSchedule = async (trainrunSection : TrainrunSectionOperation) => {
    const { sourceNode, targetNode } = trainrunSection;
    console.log('trainrunSection: ', trainrunSection);
          const payloads : TrainScheduleBase[] = [{
            constraint_distribution: 'MARECO' as Distribution,
            path: [
              {
                trigram: sourceNode.betriebspunktName,
                id: `${sourceNode.id}`,
              },
              {
                trigram: targetNode.betriebspunktName,
                id: `${targetNode.id}`,
              }
            ],
            // TODO: change the rs name to an empty string
            rolling_stock_name: 'TC64700',
            start_time: "2024-07-15T08:00:00+02:00",
            train_name: 'test NGE',
          }];
          const trainSchedule = await postTrainSchedule({ id: timetableId!, body: payloads! }).unwrap();
          console.log('trainSchedule : ', trainSchedule)
  }

  useEffect(() => {
    const frame = frameRef.current!;

    const handleFrameLoad = () => {
      frame.removeEventListener('load', handleFrameLoad);

      const ngeRoot = frame.contentDocument!.createElement('sbb-root');
      frame.contentDocument!.body.appendChild(ngeRoot);

      // listens to create, update and delete operations
      ngeRoot.addEventListener('operation', async (event: Event) => {
        console.log('Operation received', (event as CustomEvent).detail);
        if ((event as CustomEvent).detail.type === 'create') {
          createTrainSchedule((event as CustomEvent).detail.trainrunSection);
          };
          if ((event as CustomEvent).detail.type === 'delete') {
            await deleteTrainSchedules({ body: { ids: [11,12] } }).unwrap(); 
        };
        // if ((event as CustomEvent).detail.type === 'update') {
        
        // }    
      });

        // get netzgrafik model from NGE
        // let netzgrafikDto = ngeRoot.netzgrafikDto;

        // // set new netzgrafik model with new nodes
        // netzgrafikDto.nodes = testNodesDto;
        // ngeRoot.netzgrafikDto = netzgrafikDto;
      };
    
    frame.addEventListener('load', handleFrameLoad);
  
  return () => {
    frame.removeEventListener('load', handleFrameLoad);
    };
    }, []);

  return <iframe ref={frameRef} srcDoc={frameSrc} title="NGE" className="nge-iframe-container" />;
};

export default NGE;
