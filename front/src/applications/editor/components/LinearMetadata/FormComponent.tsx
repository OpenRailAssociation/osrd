import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

import Form, { getDefaultRegistry } from '@rjsf/core';
import type { FieldProps, RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import type { GeoJsonProperties, Geometry } from 'geojson';
import type { JSONSchema7 } from 'json-schema';
import { omit, head, max as fnMax, min as fnMin, isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BsBoxArrowInLeft, BsBoxArrowInRight, BsChevronLeft, BsChevronRight } from 'react-icons/bs';
import { IoIosCut } from 'react-icons/io';
import { MdOutlineHelpOutline } from 'react-icons/md';
import { TbZoomIn, TbZoomOut, TbZoomCancel } from 'react-icons/tb';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import {
  getZoomedViewBox,
  transalteViewBox,
  splitAt,
  mergeIn,
  resizeSegment,
  SEGMENT_MIN_SIZE,
  LINEAR_METADATA_FIELDS,
  getFieldJsonSchema,
  viewboxForSelection,
  getLineStringDistance,
  fixLinearMetadataItems,
} from 'common/IntervalsDataViz/data';
import { LinearMetadataDataviz } from 'common/IntervalsDataViz/dataviz';
import type { LinearMetadataItem } from 'common/IntervalsDataViz/types';
import { tooltipPosition, notEmpty } from 'common/IntervalsDataViz/utils';

import { FormBeginEndWidget } from './FormBeginEndWidget';
import HelpModal from './HelpModal';
import { LinearMetadataTooltip } from './tooltip';
import 'common/IntervalsDataViz/style.scss';

export type FormContext = {
  geometry: Geometry;
  length: number;
  isCreation: boolean;
};

const IntervalEditorComponent = (
  props: FieldProps<LinearMetadataItem[], RJSFSchema, FormContext>
) => {
  const { name, formContext, formData, schema, onChange, registry } = props;
  const { openModal, closeModal } = useModal();
  const { t } = useTranslation();

  // Wich segment area is visible
  const [viewBox, setViewBox] = useState<[number, number] | null>(null);
  // Ref for the tooltip
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  // Wich segment is selected
  const [selected, setSelected] = useState<number | null>(null);
  // Value of the selected item (needed for the its modification)
  const [selectedData, setSelectedData] = useState<LinearMetadataItem | null>(null);
  // Wich segment is hovered
  const [hovered, setHovered] = useState<{ index: number; point: number } | null>(null);
  // Mode of the dataviz
  const [mode, setMode] = useState<'dragging' | 'resizing' | null>(null);
  // Fix the data (sort, fix gap, ...)
  const [data, setData] = useState<Array<LinearMetadataItem>>([]);
  // For mouse click / doubleClick
  const [clickTimeout, setClickTimeout] = useState<number | null>(null);
  const [clickPrevent, setClickPrevent] = useState<boolean>(false);

  // Get the distance of the geometry
  const distance = useMemo(() => {
    if (!isNil(formContext?.length)) {
      return formContext.length;
    }
    if (formContext?.geometry?.type === 'LineString') {
      return getLineStringDistance(formContext.geometry);
    }
    return 0;
  }, [formContext]);

  // Remove the 'valueField' required field because it is required by the backend. However,
  // the segment with missing values is filtered in 'customOnChange' before being sent to the backend,
  // and then re-added by 'fixLinearMetadataItems'.
  const requiredFilter = (requireds: string[]) =>
    requireds.filter((r) => ['end', 'begin'].includes(r));

  // Guess the value field of the linear metadata item
  const valueField = useMemo(() => {
    const itemProperties = (schema?.items
      ? (schema.items as JSONSchema7).properties || {}
      : {}) as unknown as { [key: string]: JSONSchema7 };
    const field = head(
      Object.keys(itemProperties)
        .filter((e) => !['begin', 'end'].includes(e))
        .map((e) => ({
          name: e,
          type: itemProperties[e] ? itemProperties[e].type || '' : '',
        }))
        .filter((e) => e.type === 'number' || e.type === 'integer')
        .map((e) => e.name)
    );
    return field;
  }, [schema]);

  const customOnChange = useCallback(
    (newData: Array<LinearMetadataItem>) => {
      // Remove item without value, it will be recreated by the fixLinearMetadataItems function
      onChange(newData.filter((e) => (valueField ? !isNil(e[valueField]) : true)));
    },
    [onChange, valueField]
  );

  const fixedData = useMemo(
    () => fixLinearMetadataItems(formData?.filter(notEmpty), distance),
    [formData, distance]
  );

  /**
   * When the formData changed
   * => we recompute the linearmedata
   */
  useEffect(() => {
    closeModal();
    setData(fixedData);
    setSelected((old) => (old !== null && fixedData[old] ? old : null));
    setHovered((old) => (old != null && fixedData[old.index] ? old : null));
  }, [fixedData]);

  /**
   * When selected element change
   * => set its data in the state
   * => recompute viewbox so selected element is always visible ()
   */
  useEffect(() => {
    setSelectedData(selected !== null && data[selected] ? data[selected] : null);
  }, [selected, data]);

  return (
    <div className="linear-metadata">
      <div className="header">
        <h4 className="control-label m-0">{schema.title || name}</h4>
        <button
          type="button"
          className="btn btn-unstyled p-1 ml-1"
          aria-label={t('common.help-display')}
          title={t('common.help-display')}
          onClick={() => openModal(<HelpModal />, 'lg')}
        >
          <MdOutlineHelpOutline />
        </button>
      </div>
      <div className="content">
        <div className="dataviz">
          <LinearMetadataDataviz
            data={data}
            field={valueField}
            viewBox={viewBox}
            highlighted={[hovered ? hovered.index : -1, selected ?? -1].filter((e) => e > -1)}
            onMouseEnter={(_e, _item, index, point) => {
              if (mode === null) setHovered({ index, point });
            }}
            onMouseLeave={() => {
              if (mode === null) setHovered(null);
            }}
            onMouseMove={(e, _item, _index, point) => {
              if (tooltipRef.current) {
                tooltipPosition([e.nativeEvent.x, e.nativeEvent.y], tooltipRef.current);
                setHovered((old) => (old ? { ...old, point } : null));
              }
            }}
            onClick={(_e, _item, index) => {
              if (mode === null) {
                const timer = window.setTimeout(() => {
                  if (!clickPrevent) {
                    // case when you click on the already selected item => reset
                    setSelected((old) => ((old ?? -1) === index ? null : index));
                    setHovered(null);
                  }
                  setClickPrevent(false);
                }, 150);
                setClickTimeout(timer);
              }
            }}
            onDoubleClick={(_e, _item, _index, point) => {
              if (clickTimeout) clearTimeout(clickTimeout);
              setClickPrevent(true);
              const newData = splitAt(data, point);
              customOnChange(newData);
            }}
            onWheel={(e, _item, _index, point) => {
              setViewBox(getZoomedViewBox(data, viewBox, e.deltaY > 0 ? 'OUT' : 'IN', point));
            }}
            onDragX={(gap, finalize) => {
              setMode(!finalize ? 'dragging' : null);
              setViewBox((vb) => transalteViewBox(data, vb, gap));
            }}
            onResize={(index, gap, finalized) => {
              setMode(!finalized ? 'resizing' : null);
              try {
                const result = resizeSegment(fixedData, index, gap, 'end');
                if (finalized) customOnChange(result.result);
                else {
                  setData(result.result);
                  // if index has changed, we need to impact the index modification
                  if (hovered && result.newIndexMapping[hovered.index] === null) {
                    setHovered({ ...hovered, index: fnMax([0, hovered.index - 1]) || 0 });
                  }
                  if (selected && result.newIndexMapping[selected] === null) {
                    setSelected(null);
                  }
                }
              } catch (e) {
                // Nothing to do here, no proper place to display the error
              }
            }}
          />
          <div className="btn-group-vertical zoom">
            <button
              aria-label={t('common.zoom-in')}
              title={t('common.zoom-in')}
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewBox(getZoomedViewBox(data, viewBox, 'IN'))}
            >
              <TbZoomIn />
            </button>
            <button
              aria-label={t('common.zoom-reset')}
              title={t('common.zoom-reset')}
              type="button"
              disabled={viewBox === null}
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewBox(null)}
            >
              <TbZoomCancel />
            </button>
            <button
              aria-label={t('common.zoom-out')}
              title={t('common.zoom-out')}
              type="button"
              disabled={viewBox === null}
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewBox(getZoomedViewBox(data, viewBox, 'OUT'))}
            >
              <TbZoomOut />
            </button>
          </div>
        </div>

        {/* Data visualisation tooltip when item is hovered */}
        {mode !== 'dragging' && hovered !== null && data[hovered.index] && (
          <div className="tooltip" ref={tooltipRef}>
            <LinearMetadataTooltip
              item={data[hovered.index]}
              point={!mode ? hovered.point : undefined}
              schema={schema.items as JSONSchema7}
            />
          </div>
        )}

        {/* Display the selection */}
        {selectedData !== null && selected !== null && data[selected] && (
          <div className="linear-metadata-selection">
            <div className="header">
              <div className="btn-toolbar" role="toolbar">
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  aria-label={t('common.previous')}
                  title={t('common.previous')}
                  disabled={selected === 0}
                  onClick={() => {
                    const newSelected = selected - 1;
                    setSelected(newSelected);
                    setViewBox((vb) => viewboxForSelection(data, vb, newSelected));
                  }}
                >
                  <BsChevronLeft />
                </button>
                <div className="btn-group">
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    aria-label={t('Editor.linear-metadata.merge-with-left')}
                    title={t('Editor.linear-metadata.merge-with-left')}
                    disabled={selected === 0}
                    onClick={() => {
                      customOnChange(mergeIn(data, selected, 'left'));
                      setSelected(selected - 1);
                    }}
                  >
                    <BsBoxArrowInLeft />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    aria-label={t('Editor.linear-metadata.split')}
                    title={t('Editor.linear-metadata.split')}
                    onClick={() => {
                      const splitPosition =
                        selectedData.begin + (selectedData.end - selectedData.begin) / 2;
                      const newData = splitAt(data, splitPosition);
                      customOnChange(newData);
                    }}
                  >
                    <IoIosCut />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    aria-label={t('Editor.linear-metadata.merge-with-right')}
                    title={t('Editor.linear-metadata.merge-with-right')}
                    disabled={selected === data.length - 1}
                    onClick={() => customOnChange(mergeIn(data, selected, 'right'))}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  aria-label={t('common.next')}
                  title={t('common.next')}
                  disabled={selected === data.length - 1}
                  onClick={() => {
                    const newSelected = selected + 1;
                    setSelected(newSelected);
                    setViewBox((vb) => viewboxForSelection(data, vb, newSelected));
                  }}
                >
                  <BsChevronRight />
                </button>
              </div>
            </div>
            <div className="content">
              <Form
                id={`selected-${selected}`}
                name="selected"
                liveValidate
                noHtml5Validate
                validator={validator}
                tagName="div"
                schema={
                  (getFieldJsonSchema(schema, registry.rootSchema, requiredFilter, {
                    begin: {
                      minimum: 0,
                      maximum: fnMax([selectedData.begin, selectedData.end - SEGMENT_MIN_SIZE]),
                    },
                    end: {
                      minimum: fnMin([selectedData.end, data[selected].begin + SEGMENT_MIN_SIZE]),
                      maximum:
                        selected !== data.length - 1
                          ? fnMax([selectedData.end, data[selected + 1].end - SEGMENT_MIN_SIZE])
                          : selectedData.end,
                    },
                  }).items as JSONSchema7) || {}
                }
                uiSchema={{
                  begin: {
                    'ui:widget': FormBeginEndWidget,
                    'ui:readonly': selected === 0,
                  },
                  end: {
                    'ui:widget': FormBeginEndWidget,
                    'ui:readonly': selected === data.length - 1,
                  },
                }}
                formData={selectedData}
                onChange={(e) => {
                  const newItem = e.formData;
                  const oldItem = data[selected];
                  let newData = [...data];
                  // we keep the old value for begin and end
                  // they will be change in the resize function if needed
                  newData[selected] = {
                    ...oldItem,
                    ...omit(newItem, ['begin', 'end']),
                  };

                  // Check if there is a resize
                  try {
                    if (newItem.begin !== oldItem.begin) {
                      const resizeBegin = resizeSegment(
                        [...newData],
                        selected,
                        newItem.begin - oldItem.begin,
                        'begin'
                      );
                      newData = resizeBegin.result;
                    }
                    if (oldItem.end !== newItem.end) {
                      const resizeEnd = resizeSegment(
                        [...newData],
                        selected,
                        newItem.end - oldItem.end,
                        'end'
                      );
                      newData = resizeEnd.result;
                    }
                    customOnChange(newData);
                  } catch (error) {
                    // Nothing to do here, no proper place to display the error
                  } finally {
                    setSelectedData(newItem);
                  }
                }}
              >
                <div className="buttons">
                  <button
                    type="button"
                    title={t('common.close')}
                    className="btn btn-outline-dark mx-1"
                    onClick={() => setSelected(null)}
                  >
                    {t('common.close')}
                  </button>
                </div>
              </Form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const FormComponent = (props: FieldProps<unknown, RJSFSchema, FormContext>) => {
  const { name, formContext, schema, registry } = props;
  const Fields = getDefaultRegistry().fields;

  // Get the distance of the geometry
  const distance = useMemo(() => {
    if (!isNil(formContext?.length)) {
      return formContext.length;
    }
    if (formContext?.geometry?.type === 'LineString') {
      return getLineStringDistance(formContext.geometry);
    }
    return 0;
  }, [formContext]);

  // Remove the 'valueField' required field because it is required by the backend. However,
  // the segment with missing values is filtered in 'customOnChange' before being sent to the backend,
  // and then re-added by 'fixLinearMetadataItems'.
  const requiredFilter = (requireds: string[]) =>
    requireds.filter((r) => ['end', 'begin'].includes(r));

  // Compute the JSON schema of the linear metadata item
  const jsonSchema = useMemo(
    () =>
      getFieldJsonSchema(
        schema,
        registry.rootSchema,
        requiredFilter,
        distance
          ? {
              begin: {
                minimum: 0,
                maximum: distance,
              },
              end: {
                minimum: 0,
                maximum: distance,
              },
            }
          : {}
      ),
    [schema, registry.rootSchema, distance]
  );

  if (LINEAR_METADATA_FIELDS.includes(name))
    return (
      <IntervalEditorComponent
        jsonSchema={jsonSchema}
        distance={distance}
        requiredFilter={requiredFilter}
        {...(props as FieldProps<LinearMetadataItem[], RJSFSchema, FormContext>)}
      />
    );
  return (
    <Fields.ArrayField
      {...(props as FieldProps<GeoJsonProperties, RJSFSchema, FormContext>)}
      schema={jsonSchema}
    />
  );
};

export default FormComponent;
