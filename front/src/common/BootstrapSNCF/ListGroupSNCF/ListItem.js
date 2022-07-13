import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { getDeepObjectData } from 'utils/helpers';

const style = {
  listItem: {
    border: 'none',
    borderTop: '1px solid #d7d7d7',
  },
  itemMain: {
    flex: '1 1 100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  itemContent: {
    minHeight: '4rem',
  },
};
export default class ListItem extends Component {
  static propTypes = {
    item: PropTypes.object.isRequired,
    subtitles: PropTypes.array.isRequired,
    actions: PropTypes.func.isRequired,
    noBorder: PropTypes.bool,
  }

  static defaultProps = {
    noBorder: false,
  }

  render() {
    const {
      item, subtitles, actions, noBorder,
    } = this.props;

    return (
      <li className="list-group-item management-item" style={noBorder ? style.listItem : {}}>
        <div className="management-item-content" style={style.itemContent}>
          <div className="management-item-symbol">
            <i className="icons-document icons-size-1x25" aria-hidden="true" />
          </div>
          <div className="management-item-main" style={style.itemMain}>
            <h2>{item.name}</h2>
            <ul className="meta-list font-weight-medium">
              {
                subtitles.map((subtitle, index) => {
                  const separator = index !== 0 ? 'separator' : '';
                  return (
                    <li
                      key={subtitle.value}
                      className={`meta-list-item ${separator}`}
                    >
                      {`${subtitle.label} : ${getDeepObjectData(item, subtitle)}`}
                    </li>
                  );
                })
              }
            </ul>
          </div>
          {actions(item)}
        </div>
      </li>
    );
  }
}
