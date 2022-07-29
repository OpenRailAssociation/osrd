import React, { useState, useRef, useEffect } from 'react';
import Form, { FieldProps, utils } from '@rjsf/core';
import Fields from '@rjsf/core/lib/components/fields';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { omit, head, max as fnMax, min as fnMin } from 'lodash';
import { BiZoomIn, BiZoomOut } from 'react-icons/bi';
import { BsBoxArrowInLeft, BsBoxArrowInRight, BsChevronLeft, BsChevronRight } from 'react-icons/bs';
import { IoIosCut } from 'react-icons/io';
import { useTranslation } from 'react-i18next';

import { tooltipPosition } from './utils';
import {
  LinearMetadataItem,
  getZoomedViewBox,
  transalteViewBox,
  splitAt,
  mergeIn,
  resizeSegment,
  SEGMENT_MIN_SIZE,
} from './data';
import { LinearMetadataDataviz } from './dataviz';
import { LinearMetadataTooltip } from './tooltip';
import { FormBeginEndWidget } from './FormBeginEndWidget';
import './style.scss';

function itemSchema(
  fieldSchema: JSONSchema7,
  rootSchema: JSONSchema7,
  enhancement: { [key: string]: JSONSchema7Definition } = {}
): JSONSchema7 | undefined {
  const schema = utils.retrieveSchema(fieldSchema.items as JSONSchema7, rootSchema);
  if (!schema.properties?.begin || !schema.properties?.end) {
    // Not a linear metadata item
    return undefined;
  }

  /* eslint-disable prefer-object-spread */
  const result = {
    ...schema,
    properties: {
      begin: Object.assign({}, schema.properties.begin, enhancement.begin ? enhancement.begin : {}),
      end: Object.assign({}, schema.properties.end, enhancement.end ? enhancement.end : {}),
      ...Object.keys(schema.properties)
        .filter((k) => !['begin', 'end'].includes(k))
        .map((k) => ({ name: k, schema: schema.properties ? schema.properties[k] : {} }))
        .reduce((acc, curr) => {
          acc[curr.name] = Object.assign(
            {},
            curr.schema,
            enhancement[curr.name] ? enhancement[curr.name] : {}
          );
          return acc;
        }, {} as { [key: string]: JSONSchema7Definition }),
    },
    definitions: rootSchema.definitions,
  };
  /* eslint-enable prefer-object-spread */
  return result;
}

/**
 * Helper function that move the viewbox so the selected element is visible.
 */
function viewboxForSelection(
  data: Array<LinearMetadataItem>,
  vb: [number, number] | null,
  selected: number
): [number, number] | null {
  // case of no zoom
  if (vb === null) return null;

  // if the selected is left outside
  if (data[selected].end <= vb[0]) {
    return transalteViewBox(data, vb, data[selected].begin - vb[0]);
  }
  // if the selected is right outside
  if (vb[1] <= data[selected].begin) {
    return transalteViewBox(data, vb, data[selected].end - vb[1]);
  }
  return vb;
}

export const FormComponent: React.FC<FieldProps> = (props) => {
  const { name, formData, schema, onChange, registry } = props;
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
  const [hovered, setHovered] = useState<number | null>(null);
  // Mode of the dataviz
  const [mode, setMode] = useState<'dragging' | 'resizing' | null>(null);
  // Fix the data (sort, fix gap, ...)
  const [data, setData] = useState<Array<LinearMetadataItem>>([]);

  // Compute the JSON schema of the linear metadata item
  const jsonSchema = itemSchema(schema, registry.rootSchema);

  // Guess the value field of the linear metadata item
  const valueField = head(
    Object.keys(jsonSchema?.properties || {})
      .filter((e) => !['begin', 'end'].includes(e))
      .map((e) => ({
        name: e,
        type: jsonSchema?.properties ? (jsonSchema?.properties[e] as JSONSchema7).type : '',
      }))
      .filter((e) => e.type === 'number' || e.type === 'integer')
      .map((e) => e.name)
  );

  /**
   * When the formData changed or the form context
   * => we recompute the linearmedata
   */
  useEffect(() => {
    setData(formData);
  }, [formData]);

  /**
   * When selected element change
   * => set its data in the state
   * => recompute viewbox so selected element is always visible ()
   */
  useEffect(
    () => {
      setSelectedData(selected !== null ? data[selected] : null);
    },
    // The "data" is omitted here, otherwise it is always refreshed
    [selected, data]
  );

  if (!jsonSchema) return <Fields.ArrayField {...props} />;
  return (
    <div className="linear-metadata">
      <div className="header">
        <h4 className="control-label">{schema.title || name}</h4>
      </div>
      <div className="content">
        <div className="dataviz">
          <LinearMetadataDataviz
            data={data}
            field={valueField}
            viewBox={viewBox}
            highlighted={[hovered ?? -1, selected ?? -1].filter((e) => e > -1)}
            onMouseEnter={(_e, _item, index) => {
              if (mode === null) setHovered(index);
            }}
            onMouseLeave={() => {
              if (mode === null) setHovered(null);
            }}
            onMouseMove={(e) => {
              if (tooltipRef.current) {
                tooltipPosition([e.nativeEvent.x, e.nativeEvent.y], tooltipRef.current);
              }
            }}
            onClick={(_e, _item, index) => {
              if (mode === null) {
                // case when you click on the already selected item => reset
                setSelected((old) => ((old ?? -1) === index ? null : index));
                setHovered(null);
              }
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
                const newData = resizeSegment(formData, index, gap, 'end', { segmentMinSize: 5 });
                if (finalized) onChange(newData);
                else setData(newData);
              } catch (e) {
                // TODO: should we display it ?
              }
            }}
          />
          <div className="btn-group-vertical zoom">
            <button
              title={t('common.zoom-in')}
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewBox(getZoomedViewBox(data, viewBox, 'IN'))}
            >
              <BiZoomIn />
            </button>
            <button
              title={t('common.zoom-out')}
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewBox(getZoomedViewBox(data, viewBox, 'OUT'))}
            >
              <BiZoomOut />
            </button>
          </div>
        </div>

        {/* Data visualisation tooltip when item is hovered */}
        {mode !== 'dragging' && hovered !== null && (
          <div className="tooltip" ref={tooltipRef}>
            <LinearMetadataTooltip item={data[hovered]} schema={jsonSchema} />
          </div>
        )}

        {/* Display the selection */}
        {selectedData !== null && selected !== null && (
          <div className="linear-metadata-selection">
            <div className="header">
              <div className="btn-toolbar" role="toolbar">
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
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
                    title={t('Editor.linear-metadata.merge-with-left')}
                    disabled={selected === 0}
                    onClick={() => {
                      onChange(mergeIn(data, selected, 'left'));
                      setSelected(selected - 1);
                    }}
                  >
                    <BsBoxArrowInLeft />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    title={t('Editor.linear-metadata.split')}
                    onClick={() => {
                      const splitPosition =
                        selectedData.begin + (selectedData.end - selectedData.begin) / 2;
                      const newData = splitAt(data, splitPosition);
                      onChange(newData);
                    }}
                  >
                    <IoIosCut />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    title={t('Editor.linear-metadata.merge-with-right')}
                    disabled={selected === data.length - 1}
                    onClick={() => onChange(mergeIn(data, selected, 'right'))}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
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
                tagName="div"
                schema={
                  itemSchema(schema, registry.rootSchema, {
                    begin: {
                      minimum:
                        selected !== null && data[selected - 1]
                          ? fnMin([selectedData.begin, data[selected - 1].begin + SEGMENT_MIN_SIZE])
                          : 0,
                      maximum: fnMax([selectedData.begin, selectedData.end - SEGMENT_MIN_SIZE]),
                    },
                    end: {
                      minimum: fnMin([selectedData.end, data[selected].begin + SEGMENT_MIN_SIZE]),
                      maximum:
                        selected !== data.length - 1
                          ? fnMax([selectedData.end, data[selected + 1].end - SEGMENT_MIN_SIZE])
                          : selectedData.end,
                    },
                  }) || {}
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
                  if (e.errors.length === 0) {
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
                        newData = resizeSegment(
                          [...newData],
                          selected,
                          newItem.begin - oldItem.begin,
                          'begin'
                        );
                      }
                      if (oldItem.end !== newItem.end) {
                        newData = resizeSegment(
                          [...newData],
                          selected,
                          newItem.end - oldItem.end,
                          'end'
                        );
                      }
                      onChange(newData);
                    } catch (error) {
                      // TODO: Should we display the resize error ?
                    } finally {
                      setSelectedData(newItem);
                    }
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

export default FormComponent;
