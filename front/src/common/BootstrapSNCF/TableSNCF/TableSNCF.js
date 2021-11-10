import React from 'react';
import PropTypes from 'prop-types';
import TableHeaderSNCF from './TableHeaderSNCF';
import TableContentSNCF from './TableContentSNCF';

export default class TableSNCF extends React.Component {
  static propTypes = {
    headerContent: PropTypes.array.isRequired,
    content: PropTypes.array,
    onClick: PropTypes.func,
    headerSort: PropTypes.func,
    hovered: PropTypes.bool,
    selected: PropTypes.string,
  }

  static defaultProps = {
    headerSort: false,
    hovered: false,
    onClick: undefined,
    selected: '',
    content: [],
  }

  render() {
    const {
      headerContent, headerSort, content, hovered, onClick, selected,
    } = this.props;

    return (
      <div className="table-wrapper">
        <div className="table-scroller dragscroll">
          <table className={`table ${hovered ? 'table-hover' : ''}`}>
            <caption className="sr-only">Title</caption>
            <TableHeaderSNCF headerContent={headerContent} headerSort={headerSort} />
            <TableContentSNCF content={content} onClick={onClick} selected={selected} />
          </table>
        </div>
      </div>
    );
  }
}
