import React from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';

export default class TableContentSNCF extends React.Component {
  static propTypes = {
    content: PropTypes.array,
    id: PropTypes.number,
    selected: PropTypes.string,
    onClick: PropTypes.func,
  }

  static defaultProps = {
    id: 0,
    onClick: undefined,
    selected: '',
    content: [],
  }

  render() {
    console.log('UPDATE TABLE');
    const {
      id,
      content,
      onClick,
      selected,
    } = this.props;

    const listLines = content.map((line) => {
      const key = (id === 0) ? nextId() : id;
      const lineSelected = (selected === line.id) ? 'stationselected' : '';

      return (
        <tr key={key} onClick={onClick} role="button" id={line.id} className={lineSelected}>
          {line.items.map((item) => <td key={nextId()}><div className="cell-inner">{item}</div></td>)}
        </tr>
      );
    });

    return (
      <tbody>
        {listLines}
      </tbody>
    );
  }
}
