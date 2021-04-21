import React, { FC } from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

const ModalUnplugged: FC<{ onClose: () => void; id?: string; title?: string; t: TFunction }> = ({
  t,
  id,
  title,
  onClose,
  children,
}) => (
  <div
    className="modal fade show"
    id={id}
    tabIndex={-1}
    role="dialog"
    aria-labelledby={id}
    style={{ display: 'block' }}
  >
    <div
      className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg"
      role="document"
    >
      <div
        className="modal-backdrop"
        style={{ background: '#0003', zIndex: 'unset' }}
        onClick={() => onClose()}
      />
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="h1 modal-title">{title}</h5>
          <button type="button" className="close" aria-label={t('common.close')} onClick={onClose}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  </div>
);

ModalUnplugged.propTypes = {
  t: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  id: PropTypes.string,
  title: PropTypes.string,
};

ModalUnplugged.defaultProps = {
  id: undefined,
  title: undefined,
};

const Modal = withTranslation()(ModalUnplugged);

export default Modal;
