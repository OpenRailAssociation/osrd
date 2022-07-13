import React from 'react';
import PropTypes from 'prop-types';

export const BAR_ITEM_TYPES = {
  button: 'button',
  modal: 'modal',
  iconButton: 'iconButton',
  custom: 'custom',
};

export default class ActionBarItem extends React.Component {
  static propTypes = {
    type: PropTypes.oneOf(Object.values(BAR_ITEM_TYPES)).isRequired,
    content: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object,
    ]).isRequired,
    onClick: PropTypes.func,
    iconName: PropTypes.string,
    modalId: PropTypes.string,
    spacing: PropTypes.bool,
  }

  static defaultProps = {
    onClick: () => {},
    iconName: undefined,
    modalId: undefined,
    spacing: false,
  }

  renderContent = () => {
    const {
      type, content, onClick, modalId, iconName,
    } = this.props;

    switch (type) {
      case BAR_ITEM_TYPES.button:
        return (
          <div className="btn-group dropdown">
            <button type="button" className="btn btn-sm btn-primary" onClick={onClick}>
              <span>{content}</span>
            </button>
          </div>
        );
      case BAR_ITEM_TYPES.modal:
        return (
          <button type="button" className="btn btn-sm btn-transparent btn-color-gray toolbar-item-spacing" data-target={`#${modalId}`} data-toggle="modal">
            {content}
          </button>
        );
      case BAR_ITEM_TYPES.iconButton:
        return (
          <button type="button" className="btn btn-sm btn-transparent btn-color-gray toolbar-item-spacing collapseFiltersButton" onClick={onClick}>
            <span className="sr-only">{content}</span>
            <i className={`${iconName} icons-size-1x25`} aria-hidden="true" />
          </button>
        );
      case BAR_ITEM_TYPES.custom:
        return content;
      default:
        return null;
    }
  }

  render() {
    const { spacing } = this.props;

    return (
      <li className={`toolbar-item ${spacing ? 'toolbar-item-spacing' : ''}`}>
        {this.renderContent()}
      </li>
    );
  }
}
