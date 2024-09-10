import { useCallback, useContext, useEffect } from 'react';

import { useTranslation } from 'react-i18next';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { getEntities } from 'applications/editor/data/api';
import TOOL_NAMES from 'applications/editor/tools/constsToolNames';
import type { TrackSplitState } from 'applications/editor/tools/trackSplit/types';
import { isOffsetValid } from 'applications/editor/tools/trackSplit/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useInfraID } from 'common/osrdContext';
import { saveSplitTrackSection } from 'reducers/editor/thunkActions';

const TrackSplitLeftPanel = () => {
  const { t } = useTranslation(['translation', 'infraEditor']);
  const infraID = useInfraID();
  const { state, setState, isFormSubmited, setIsFormSubmited, switchTool, dispatch } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<TrackSplitState>;

  const submit = useCallback(
    async (s: TrackSplitState) => {
      if (isOffsetValid(s.offset, s.track)) {
        // Call the API to split the track
        const res = await dispatch(saveSplitTrackSection(infraID, s.track.properties.id, s.offset));
        // From the result, get the two newly tracksections
        const tracksections = await getEntities(infraID!, res, 'TrackSection', dispatch);
        // Redirect to the selection tool with the tracksections selected
        switchTool({
          toolType: TOOL_NAMES.SELECTION,
          toolState: {
            selection: Object.values(tracksections),
          },
        });
      }
    },
    [dispatch, switchTool, infraID]
  );

  /**
   * When clicking on the save button in the toolbar
   */
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited) {
      setIsFormSubmited(false);
      submit(state);
    }
  }, [isFormSubmited, setIsFormSubmited]);

  const isValid = isOffsetValid(state.offset, state.track);
  const trackLength = state.track.properties.length;

  return (
    <>
      <h3> {t('Editor.tools.track-split.title')}</h3>
      <div className="selection-left-panel">
        <div className="pb-2 entity">
          <EntitySumUp entity={state.track} classes={{ small: '' }} />
        </div>
      </div>

      <div>
        <span className="font-weight-medium">
          {t('infraEditor:TrackSection.properties.length.title')}
        </span>
        <p>
          {t('infraEditor:TrackSection.properties.length.description')} : {trackLength}
        </p>
      </div>
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(state);
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="font-weight-medium" htmlFor="offset">
            {t('Editor.tools.track-split.offset.label')}
          </label>
          <p> {t('Editor.tools.track-split.offset.description')}</p>
          <InputSNCF
            id="offset"
            type="number"
            inputProps={{ required: true }}
            value={state.offset === 0 ? '' : state.offset / 1000}
            min={1}
            max={trackLength}
            whiteBG
            focus
            isInvalid={!isValid}
            errorMsg={
              !isValid
                ? t('Editor.tools.track-split.offset.error', {
                    max: trackLength,
                  }).toString()
                : undefined
            }
            onChange={(e) => {
              setState((prev) => ({
                ...prev,
                offset: e.target.valueAsNumber * 1000 || 0,
              }));
            }}
          />
        </form>
      </div>
    </>
  );
};

export default TrackSplitLeftPanel;
