import React, { FC, useCallback, useContext, useEffect, useState } from 'react';
import { keyBy } from 'lodash';
import Select from 'react-select';
import { FieldProps } from '@rjsf/core';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { FaMapMarkedAlt, FaTimesCircle } from 'react-icons/fa';
import EditorContext from 'applications/editor/context';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getEntity } from 'applications/editor/data/api';
import Tipped from 'applications/editor/components/Tipped';
import { DEFAULT_ENDPOINT, ENDPOINTS, ENDPOINTS_SET, TrackSectionEntity } from 'types';
import { FLAT_SWITCH_PORTS_PREFIX } from '../utils';
import { PortEndPointCandidate, SwitchEditionState } from '../types';
import { ExtendedEditorContextType } from '../../editorContextTypes';

const ENDPOINT_OPTIONS = ENDPOINTS.map((s) => ({ value: s, label: s }));
const ENDPOINT_OPTIONS_DICT = keyBy(ENDPOINT_OPTIONS, 'value');

const TrackSectionEndpointSelector: FC<FieldProps> = ({ schema, formData, onChange, name }) => {
  const dispatch = useDispatch();
  const { state, setState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<SwitchEditionState>;
  const { t } = useTranslation();
  const infraID = useSelector(getInfraID);

  const portId = name.replace(FLAT_SWITCH_PORTS_PREFIX, '');
  const endpoint = ENDPOINTS_SET.has(formData?.endpoint) ? formData.endpoint : DEFAULT_ENDPOINT;
  const [trackSection, setTrackSection] = useState<TrackSectionEntity | null>(null);

  const isPicking =
    state.portEditionState.type === 'selection' && state.portEditionState.portId === portId;
  const isDisabled =
    state.portEditionState.type === 'selection' && state.portEditionState.portId !== portId;

  const startPickingPort = useCallback(() => {
    // Cancel current selection:
    if (isPicking) {
      setState({
        ...state,
        portEditionState: {
          type: 'idle',
        },
      });
    }
    // Start selecting:
    else if (!isDisabled) {
      setState({
        ...state,
        portEditionState: {
          type: 'selection',
          portId,
          hoveredPoint: null,
          onSelect: (hoveredPoint: PortEndPointCandidate) => {
            onChange({
              endpoint: hoveredPoint.endPoint,
              track: hoveredPoint.trackSectionId,
            });
          },
        },
      });
    }
  }, [isDisabled, isPicking, onChange, portId, setState, state]);

  useEffect(() => {
    if (typeof formData?.track === 'string') {
      getEntity<TrackSectionEntity>(
        infraID as number,
        formData.track,
        'TrackSection',
        dispatch
      ).then((track) => {
        setTrackSection(track);
      });
    } else {
      setTrackSection(null);
    }
  }, [formData?.track, infraID]);

  return (
    <div className="mb-4">
      {schema.title && <h5>{schema.title}</h5>}
      {schema.description && <p>{schema.description}</p>}
      <div className="d-flex flex-row align-items-center mb-2">
        <div className="flex-grow-1 flex-shrink-1 mr-2">
          {trackSection ? (
            <span>
              {trackSection?.properties?.extensions?.sncf?.line_name || trackSection.properties.id}
            </span>
          ) : (
            <span className="text-danger font-weight-bold">
              {t('Editor.tools.switch-edition.no-track-picked-yet')}
            </span>
          )}
          {!!trackSection && <div className="text-muted small">{trackSection.properties.id}</div>}
          {!!trackSection && (
            <div className="d-flex flex-row align-items-baseline mb-2">
              <span className="mr-2">{t('Editor.tools.switch-edition.endpoint')}</span>
              <Select
                value={ENDPOINT_OPTIONS_DICT[endpoint]}
                options={ENDPOINT_OPTIONS}
                onChange={(o) => {
                  if (o)
                    onChange({
                      endpoint: o.value,
                      track: trackSection.properties.id,
                    });
                }}
              />
            </div>
          )}
        </div>
        <Tipped mode="left">
          <button
            type="button"
            className="btn btn-primary px-3"
            onClick={startPickingPort}
            disabled={isDisabled}
          >
            {isPicking ? <FaTimesCircle /> : <FaMapMarkedAlt />}
          </button>
          <span>
            {t(
              `Editor.tools.switch-edition.actions.${
                isPicking ? 'pick-track-cancel' : 'pick-track'
              }`
            )}
          </span>
        </Tipped>
      </div>
    </div>
  );
};

export default TrackSectionEndpointSelector;
