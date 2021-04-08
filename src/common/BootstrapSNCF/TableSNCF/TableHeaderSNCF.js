import React from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';

export default class TableHeaderSNCF extends React.Component {
  static propTypes = {
    headerContent: PropTypes.array.isRequired,
    headerSort: PropTypes.func,
  }

  static defaultProps = {
    headerSort: undefined,
  }

  sortOnClick = (id) => {
    const { headerSort } = this.props;
    headerSort(id);
  }

  render() {
    const {
      headerContent,
    } = this.props;

    const listItems = headerContent.map((item, id) => (
      <th scope="col" key={nextId()} data-id={id} onClick={() => this.sortOnClick(id)}>
        <div className="cell-inner">{item}</div>
      </th>
    ));

    return (
      <thead className="thead thead-light">
        <tr>
          {listItems}
        </tr>
      </thead>
    );
  }
}
