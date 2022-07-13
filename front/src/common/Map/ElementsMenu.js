import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import { bindActionCreators } from 'redux';
import nextId from 'react-id-generator';

// Components
import FilterMenuCategorySNCF from 'common/BootstrapSNCF/FilterMenuSNCF/FilterMenuCategorySNCF';
import FilterMenuSNCF from 'common/BootstrapSNCF/FilterMenuSNCF/FilterMenuSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import FilterMenuItemSNCF from 'common/BootstrapSNCF/FilterMenuSNCF/FilterMenuItemSNCF';

// Assets, Helpers and Styles
import { ELEMENT_TYPES } from 'common/Map/const';
import * as allMapActions from 'reducers/map';
import { differenceWith } from 'lodash';

class RawElementsMenu extends Component {
  static propTypes = {
    map: PropTypes.object.isRequired,
    mapActions: PropTypes.object.isRequired,
    t: PropTypes.func.isRequired,
    withHeader: PropTypes.bool,
  }

  static defaultProps = {
    withHeader: false,
  }

  toggleObjectsMenu = () => {
    const { mapActions } = this.props;
    mapActions.toggleObjects();
  }

  updateSelectedChildElementList = (parent, child, elementType) => {
    const { map, mapActions } = this.props;
    if (!map.elements.selected.objects.find((obj) => obj.key === parent.key)) {
      mapActions.updateSelectedElement(parent, elementType, true);
    }
    mapActions.updateSelectedChildElement(parent, child, elementType, true);
  }

  updateSelectedElementsList = (element, elementType, isSelected) => {
    const { mapActions } = this.props;
    if (isSelected && elementType === ELEMENT_TYPES.objects && element.children !== undefined) {
      const child = element.children.find((c) => c.default);
      mapActions.updateSelectedChildElement(element, child, elementType, isSelected);
    }
    mapActions.updateSelectedElement(element, elementType, isSelected);
  }

  onObjectsGroupSelect = (group, isChecked) => {
    this.updateSelectedElementsList(group, ELEMENT_TYPES.groups, isChecked);
    Object.keys(group.content).forEach((object) => {
      this.updateSelectedElementsList(object, ELEMENT_TYPES.objects, isChecked);
    });
  }

  searchObjects = (search) => {
    const { mapActions } = this.props;
    mapActions.updateSearchObjects(search);
  }

  renderObjects = (objects, checked) => {
    if (objects.length === 0) {
      return null;
    }

    return (
      objects.map((object) => {
        let hasOneChildSelected = false;
        if (object.children) {
          hasOneChildSelected = object.children.filter((child) => child.selected).length !== 0;
        }
        return (
          <React.Fragment key={object.key}>
            <FilterMenuItemSNCF
              key={`object${nextId()}`}
              title={object.label}
              htmlID={`object${nextId()}`}
              onChange={(e) => this.updateSelectedElementsList(
                object,
                ELEMENT_TYPES.objects,
                e.target.checked,
              )}
              checked={checked}
            />
            {object.children && object.children.map((child) => {
              const htmlID = child.key + nextId();
              const isChecked = checked && !!(child.selected || (child.default && !hasOneChildSelected));
              // const isChecked = checked && !!(child.selected);
              return (
                <div className="filters-menu-item has-hover ml-3" key={child.key}>
                  <div className="custom-control custom-checkbox ">
                    <input
                      type="checkbox"
                      name={child.key}
                      className="custom-control-input"
                      id={htmlID}
                      checked={isChecked}
                      onChange={() => this.updateSelectedChildElementList(
                        object,
                        child,
                        ELEMENT_TYPES.objects,
                      )}
                    />
                    <label className="custom-control-label w-100" htmlFor={htmlID}>
                      <div className="d-flex w-100">
                        <div className="flex-grow-1">{child.label}</div>
                      </div>
                    </label>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        );
      })
    );
  }

  renderObjectsGroups = (groups, checked) => groups.map((group) => (
    <FilterMenuItemSNCF
      key={`object-group${nextId()}`}
      title={group.label}
      htmlID={`object-group${nextId()}`}
      onChange={(e) => this.onObjectsGroupSelect(group, e.target.checked)}
      checked={checked}
    />
  ))

  render = () => {
    const { t, map, withHeader } = this.props;
    const { elements } = map;
    const { selected, filtered, search } = elements;

    let { all } = elements;
    if (search.length !== 0) {
      all = filtered;
    }

    // Build the array of notSelected elements
    const notSelected = {};
    Object.keys(all).forEach((elementType) => {
      notSelected[elementType] = differenceWith(all[elementType], selected[elementType], (el1, el2) => (el1.key === el2.key));
    });

    // search header, placed on top of the menu
    const header = (
      <InputSNCF
        type="text"
        id="object-search"
        onChange={(e) => this.searchObjects(e.target.value)}
        value={elements.search}
        placeholder={t('Map.search.placeholder')}
        label={t('Map.search.placeholder')}
        onClear={() => this.searchObjects('')}
        clearButton
      />
    );

    // Diplay groups
    const displayGroups = selected.groups.length !== 0
                       || notSelected.groups.length !== 0;

    // Divider display between selected and not selected elements
    const displayGroupsDivider = selected.groups.length !== 0
                              && notSelected.groups.length !== 0;

    const displayObjectsDivider = selected.objects.length !== 0
                               && notSelected.objects.length !== 0;

    // Diplay error message when filter doesn't match anything
    const noObjectMatch = search.length !== 0
                       && filtered.objects.length === 0;

    const noGroupMatch = search.length !== 0
                      && filtered.groups.length === 0;

    return (
      <FilterMenuSNCF
        header={withHeader ? header : undefined}
        isShown={elements.shown}
        toggleFiltersMenu={this.toggleObjectsMenu}
      >
        <FilterMenuCategorySNCF
          title="OBJETS"
          htmlID={`filterCategory${nextId()}`}
          expanded
        >
          {this.renderObjects(selected.objects, true)}
          {displayObjectsDivider && (
            <div className="dropdown-divider mt-4 mb-4" />
          )}
          {this.renderObjects(notSelected.objects, false)}
          {noObjectMatch && (
            <div className="mt-2">
              {t('Map.elementsMenu.noObjectMatch')}
            </div>
          )}
        </FilterMenuCategorySNCF>
        {displayGroups && (
          <FilterMenuCategorySNCF
            title="GROUPES D'OBJETS"
            htmlID={`filterCategory${nextId()}`}
            expanded
          >
            {this.renderObjectsGroups(selected.groups, true)}
            {displayGroupsDivider && (
            <div className="dropdown-divider mt-4 mb-4" />
            )}
            {this.renderObjectsGroups(notSelected.groups, false)}
            {noGroupMatch && (
            <div className="mt-2">
              {t('Map.elementsMenu.noGroupMatch')}
            </div>
            )}
          </FilterMenuCategorySNCF>
        )}
      </FilterMenuSNCF>
    );
  }
}

const ElementsMenu = withTranslation()(RawElementsMenu);

const mapStateToProps = (state) => ({
  map: state.map,
});

const mapDispatchToProps = (dispatch) => ({
  mapActions: bindActionCreators(allMapActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ElementsMenu);
