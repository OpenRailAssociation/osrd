/* eslint-disable jsx-a11y/interactive-supports-focus */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { DATA_TYPES } from 'common/types';
import { QUALITY_STATUS } from 'common/status';
import { getDeepObjectData } from 'utils/helpers';
import { ACTION_TYPES } from 'common/actionTypes';

class RawTableSNCF extends Component {
    static propTypes = {
      heads: PropTypes.array.isRequired,
      content: PropTypes.array.isRequired,
      t: PropTypes.func.isRequired,
      actions: PropTypes.func,
      modalId: PropTypes.string,
      itemsList: PropTypes.array,
    }

    static defaultProps = {
      actions: undefined,
      modalId: '',
      itemsList: [],
    }

    getData = (head, item) => {
      const { t, itemsList } = this.props;

      let cellContent = getDeepObjectData(item, head, itemsList);

      // Format status
      if (head.data[0].type === DATA_TYPES.status) {
        cellContent = t(QUALITY_STATUS[item.status].label);
      }

      // Format actions types
      if (head.data[0].type === DATA_TYPES.action) {
        cellContent = t(ACTION_TYPES[item.action_type].label);
      }

      return cellContent;
    }

    renderLine = (item) => {
      const { heads, actions, modalId } = this.props;

      // console.log(actions);

      return (
        <>
          {heads.map((head) => (
            <td key={head.key}>
              {head.onClick && (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <div
                  className="cell-inner text-monospace"
                  data-target={head.key === 'supervisor_id' || head.key === 'owner_id' || head.key === 'groups' ? `#${modalId}` : ''}
                  data-toggle={head.key === 'supervisor_id' || head.key === 'owner_id' || head.key === 'groups' ? 'modal' : ''}
                  onClick={() => head.onClick(item)}
                  role="button"
                >
                  {this.getData(head, item)}
                </div>
              )}
              {head.onClick === undefined && (
                <div className="cell-inner text-monospace">
                  {this.getData(head, item)}
                </div>
              )}
            </td>
          ))}
          {/* <td className="cell-placeholder"><span /></td> */}
          {actions && (
            <td className="cell-fixed">{actions(item.id, item.status, item.layer_name, item.action_type)}</td>
          )}
        </>
      );
    }

    render() {
      const {
        heads, content, t, actions,
      } = this.props;

      return (
        <div className="col-12 mt-3">
          <div className="table-wrapper">
            <div className="table-scroller last-cell-fixed dragscroll">
              <table className="table table-hover">
                <thead className="thead thead-light">
                  <tr>
                    {heads.map((head) => (<th scope="col" key={head.key}><div className="cell-inner">{t(head.label)}</div></th>))}
                    {/* <td className="cell-placeholder" aria-hidden="true"><span /></td> */}
                    {actions && (<th className="cell-fixed"><span className="sr-only">Actions</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {content.map((item) => (
                    <tr key={item.id} id={item.id} className={item.has_been_restored ? 'table-success' : ''}>
                      {this.renderLine(item)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
}

const TableSNCF = withTranslation()(RawTableSNCF);

export default TableSNCF;
