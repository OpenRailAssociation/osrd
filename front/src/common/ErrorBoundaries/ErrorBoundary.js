import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/browser';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as allMapActions from 'reducers/map';
import * as allLogsActions from 'reducers/logs';
import * as allZonesActions from 'reducers/zones';
import * as allProfileActions from 'reducers/profile';
import { withTranslation } from 'react-i18next';

class RawErrorBoundary extends Component {
    static propTypes = {
      children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]).isRequired,
      t: PropTypes.func.isRequired,
      user: PropTypes.object.isRequired,
      map: PropTypes.object.isRequired,
      mapActions: PropTypes.object.isRequired,
      logs: PropTypes.object.isRequired,
      logsActions: PropTypes.object.isRequired,
      zones: PropTypes.object.isRequired,
      zonesActions: PropTypes.object.isRequired,
      profile: PropTypes.object.isRequired,
      profileActions: PropTypes.object.isRequired,
    }

    constructor(props) {
      super(props);
      this.state = {
        eventId: '',
        hasError: false,
      };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      console.log({ error, errorInfo });

      Sentry.withScope((scope) => {
        scope.setExtras(errorInfo);
        const eventId = Sentry.captureException(error);
        this.setState({ eventId });
      });
    }

    onReload = () => {
      const {
        mapActions, logsActions, zonesActions, profileActions,
      } = this.props;
      window.location.reload();
      mapActions.updateError(null);
      mapActions.updateSelectedObjectToCreate(undefined);
      logsActions.updateError(null);
      zonesActions.updateError(null);
      profileActions.updateError(null);
    }

    render() {
      const {
        children, t, map, user, logs, zones, profile,
      } = this.props;
      const { hasError, eventId } = this.state;
      const id = eventId === '' ? Sentry.captureException(map.error) : eventId;

      if (hasError || map.error !== null || logs.error !== null || zones.error !== null || profile.error !== null) {
        return (
          <div className="sideBar-content">
            <div className="m-3">
              <strong>
                {t('errorBoundary.notice')}
              </strong>
            </div>
            <div className="d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-danger m-4"
                onClick={() => Sentry.showReportDialog({
                  id,
                  name: `${user.account.firstName} ${user.account.lastName}`,
                  email: user.account.email,
                  title: t('errorBoundary.notice'),
                })}
              >
                {t('errorBoundary.feedbackButton')}
              </button>
              <button
                type="button"
                className="btn btn-primary m-4"
                data-dismiss="modal"
                onClick={() => this.onReload()}
              >
                {t('errorBoundary.reloadButton')}
              </button>
            </div>

          </div>
        );
      }
      return children;
    }
}

const ErrorBoundary = withTranslation()(RawErrorBoundary);

const mapStateToProps = (state) => ({
  user: state.user,
  map: state.map,
  logs: state.logs,
  zones: state.zones,
  profile: state.profile,
});

const mapDispatchToProps = (dispatch) => ({
  mapActions: bindActionCreators(allMapActions, dispatch),
  logsActions: bindActionCreators(allLogsActions, dispatch),
  zonesActions: bindActionCreators(allZonesActions, dispatch),
  profileActions: bindActionCreators(allProfileActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ErrorBoundary);
