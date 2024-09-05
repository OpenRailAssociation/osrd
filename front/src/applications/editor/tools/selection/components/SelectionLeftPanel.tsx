import { useContext, useEffect } from 'react';

import { NoEntry } from '@osrd-project/ui-icons';
import { groupBy, map } from 'lodash';
import { useTranslation } from 'react-i18next';
import { RiFocus3Line } from 'react-icons/ri';
import { useSearchParams } from 'react-router-dom';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import type { SelectionState } from 'applications/editor/tools/selection/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

const SelectionLeftPanel = () => {
  const { t } = useTranslation();
  const { state, setState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SelectionState>;
  const { selection } = state;
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const currentUrlSelection = searchParams.get('selection');
    // Remove the select param
    if (currentUrlSelection && (selection.length === 0 || selection.length >= 100)) {
      searchParams.delete('selection');
      // Replace to avoid the user to be able to press "back" or "forward" on
      // the browser because the selection wouldn't change
      setSearchParams(searchParams, { replace: true });
      // If selection is too large, we get an error because the url is too long
    } else if (selection.length < 100) {
      // For each object in the selection state, we build the selection params with a specific syntax
      // and slice to remove the last | character
      const newUrlSelection = selection
        .reduce((acc, cur) => {
          acc += `${cur.objType}~${cur.properties.id}|`;
          return acc;
        }, '')
        .slice(0, -1);

      if (newUrlSelection && newUrlSelection !== currentUrlSelection)
        setSearchParams({ selection: newUrlSelection }, { replace: true });
    }
  }, [selection]);

  if (!selection.length)
    return <p className="text-center">{t('Editor.tools.select-items.no-selection')}</p>;

  if (selection.length > 5) {
    const types = groupBy(selection, (item) => item.objType);

    return (
      <>
        <h4>{t('Editor.tools.select-items.title')}</h4>
        <ul className="list-unstyled">
          {map(types, (items, type) => (
            <li key={type} className="pb-4">
              <div className="pb-2">
                {t('Editor.tools.select-items.selection', { count: items.length })}{' '}
                {t('Editor.tools.select-items.of-type')} <strong>{type}</strong>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mr-2"
                  onClick={() =>
                    setState({ ...state, selection: selection.filter((i) => i.objType === type) })
                  }
                >
                  <RiFocus3Line /> {t('Editor.tools.select-items.focus')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setState({ ...state, selection: selection.filter((i) => i.objType !== type) })
                  }
                >
                  <NoEntry /> {t('Editor.tools.select-items.unselect')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <h4>{t('Editor.tools.select-items.title')}</h4>
      <ul className="list-unstyled selection-left-panel">
        {selection.map((item) => (
          <li key={item.properties.id} className="pb-4">
            <div className="pb-2 entity">
              <EntitySumUp entity={item} classes={{ small: '' }} />
            </div>
            <div>
              {selection.length > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mr-2"
                  onClick={() => setState({ ...state, selection: [item] })}
                >
                  <RiFocus3Line /> {t('Editor.tools.select-items.focus')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setState({
                    ...state,
                    selection: selection.filter((i) => i.properties.id !== item.properties.id),
                  })
                }
              >
                <NoEntry /> {t('Editor.tools.select-items.unselect')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

export default SelectionLeftPanel;
