import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import TrainCompo from 'applications/osrd/components/TrainCompo/TrainCompo';
import TrainCompoCard from 'applications/osrd/components/TrainCompo/TrainCompoCard';

class TrainCompoSelector extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    modalID: PropTypes.string.isRequired,
    osrdconf: PropTypes.object.isRequired,
  }

  displayChosenCompo = () => {
    const { osrdconf } = this.props;
    return (
      <TrainCompoCard
        data={osrdconf.trainCompo}
        displayDetails={() => {}}
        active={false}
      />
    );
  }

  render() {
    const {
      t, modalID, osrdconf,
    } = this.props;

    return (
      <>
        <div className="osrd-config-item mb-2">
          <div className="osrd-config-item-container">
            {osrdconf.trainCompo !== undefined && osrdconf.trainCompo.codenbengin !== undefined ? (
              this.displayChosenCompo()
            ) : (
              <span className="mr-2 text-muted text-italic">
                {t('osrd.config.noTrainCompo')}
              </span>
            )}
            <button type="button" className="btn btn-sm btn-secondary ml-auto" data-toggle="modal" data-target={`#${modalID}`}>
              {t('osrd.config.chooseTrainCompo')}
              <i className="icons-itinerary-train ml-2" />
            </button>
          </div>
        </div>
        <ModalSNCF htmlID={modalID} optionalClasses="traincompo-modal">
          <ModalBodySNCF>
            <TrainCompo />
          </ModalBodySNCF>
          <ModalFooterSNCF>
            <div className="d-flex flex-row-reverse w-100">
              <button className="btn btn-secondary btn-sm" type="button" data-dismiss="modal">
                {t('common.close')}
              </button>
            </div>
          </ModalFooterSNCF>
        </ModalSNCF>
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  osrdconf: state.osrdconf,
});

export default connect(mapStateToProps)(withTranslation()(TrainCompoSelector));
