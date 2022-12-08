import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { updateMustRedraw, updateSpeedSpaceSettings } from 'reducers/osrdsimulation/actions';
import Allowances from './Allowances';

type PropsAreEqual<P> = (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean;

const withOSRDData = <P extends {}>(
  component: {
    (props: P): Exclude<React.ReactNode, undefined>;
    displayName?: string;
  },
  propsAreEqual?: PropsAreEqual<P> | false,

  componentName = component.displayName ?? component.name
): {
  (props: P): JSX.Element;
  displayName: string;
} => {

  function WithOSRDData(props: P) {
    //Do something special to justify the HoC.
    return component(props) as JSX.Element;
  }

  WithOSRDData.displayName = `withSampleHoC(${componentName})`;

  let wrappedComponent = propsAreEqual === false ? WithOSRDData : React.memo(WithOSRDData, propsAreEqual);

  //copyStaticProperties(component, wrappedComponent);

  return wrappedComponent as typeof WithOSRDData
};

export default withOSRDData(Allowances);
