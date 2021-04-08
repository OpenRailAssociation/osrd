import React from 'react';
import { Route, Switch } from 'react-router-dom';
import HomeSmartFlows from './HomeSmartFlows';

export default class Home extends React.Component {
  render() {
    return (
      <Switch>
        <Route exact path="/smartflows">
          <HomeSmartFlows />
        </Route>
        <Route path="/smartflows/:lat/:lon/:zoom">
          <HomeSmartFlows />
        </Route>
      </Switch>
    );
  }
}
