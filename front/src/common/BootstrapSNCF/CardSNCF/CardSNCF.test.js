import React from 'react';
import renderer from 'react-test-renderer';

import datavizPic from 'assets/pictures/dataviz.png';
import { BrowserRouter as Router } from 'react-router-dom';
import CardSNCF from './CardSNCF';

describe('Test CardSNCF', () => {
  test('should render CardSNCF', () => {
    const component = renderer.create(
      <Router>
        <CardSNCF img={datavizPic} title="DataViz" link="/midi" />
      </Router>,
    );

    const tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });
});
