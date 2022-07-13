import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ListItem from 'common/BootstrapSNCF/ListGroupSNCF/ListItem';

export default class ListGroupItem extends Component {
  static propTypes = {
    items: PropTypes.array.isRequired,
    id: PropTypes.string.isRequired,
    subtitles: PropTypes.object.isRequired,
    label: PropTypes.string.isRequired,
    actions: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);

    this.state = {
      active: false,
    };
  }

  toggleActive = () => {
    this.setState((previousState) => ({ active: !previousState.active }));
  }

  render() {
    const {
      items, id, subtitles, label, actions,
    } = this.props;
    const { active } = this.state;

    const activeClass = active ? 'active' : '';

    return (
      <li
        id={id}
        className={`list-group-item management-item management-item-group ${activeClass}`}
      >
        <div
          className="management-item-content"
          onClick={this.toggleActive}
          role="button"
          tabIndex={0}
          onKeyPress={() => {}}
        >
          <div className="management-item-caret" />
          <div className="management-item-main">
            <h2 className="mb-0 text-base font-weight-normal">
              <button
                type="button"
                className="btn-unstyled"
              >
                {label}
              </button>
            </h2>
          </div>
        </div>
        <ul id={`${id}-list`} className="management-item-grouplist">
          {
          items.map((item) => (
            <ListItem
              key={item.id}
              item={item}
              subtitles={subtitles}
              actions={actions}
              noBorder
            />
          ))
        }
        </ul>
      </li>
    );
  }
}
