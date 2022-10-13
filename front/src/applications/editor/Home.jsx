import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';

import config from '../../config/config';
import logo from '../../assets/logo_osrd_seul_blanc.svg';
import NavBarSNCF from '../../common/BootstrapSNCF/NavBarSNCF';
import Editor from './Editor';

class HomeEditorUnplugged extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
  };

  render() {
    const { t } = this.props;
    return (
      <>
        <NavBarSNCF appName={t('Editor.title')} logo={logo} />
        <div className="no-mastnav">
          <Routes>
            <Route path="/" element={<Editor urlmap={config.proxy} />} />
            <Route path="/:infra" element={<Editor urlmap={config.proxy} />} />
          </Routes>
        </div>
      </>
    );
  }
}

const HomeEditor = withTranslation()(HomeEditorUnplugged);

export default HomeEditor;
