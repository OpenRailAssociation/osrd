import React, { useState, useRef, useEffect } from 'react';
import Form, { FieldProps, utils } from '@rjsf/core';
import Fields from '@rjsf/core/lib/components/fields';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { LineString } from 'geojson';
import { last, omit, debounce, head } from 'lodash';
import cx from 'classnames';
import { BiZoomIn, BiZoomOut } from 'react-icons/bi';
import {
  BsBoxArrowInLeft,
  BsLayoutSplit,
  BsBoxArrowInRight,
  BsChevronLeft,
  BsChevronRight,
} from 'react-icons/bs';

import { tooltipPosition } from './utils';
import {
  LinearMetadataItem,
  fixLinearMetadataItems,
  getZoomedViewBox,
  splitAt,
  mergeIn,
  resizeSegment,
} from './data';
import { LinearMetadataDataviz } from './dataviz';
import { LinearMetadataTooltip } from './tooltip';
import { FormBeginEndWidget } from './FormBeginEndWidget';
import './style.scss';

function itemSchema(
  fieldSchema: JSONSchema7,
  rootSchema: JSONSchema7,
  enhancement: { [key: string]: JSONSchema7Definition } = {}
): JSONSchema7 {
  const schema = utils.retrieveSchema(fieldSchema.items as JSONSchema7, rootSchema);
  if (!schema.properties?.begin || !schema.properties?.end)
    throw new Error('Not a linear metadata item');

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
  return result;
}

const widgets = {
  BeginEndWidget: FormBeginEndWidget,
};

export const FormComponent: React.FC<FieldProps> = (props) => {
  const { name, formData, schema, onChange, formContext, registry } = props;
  // in case it's an array but the geometry is not a line
  if (!formContext.geometry || formContext.geometry.type !== 'LineString')
    return <Fields.ArrayField {...props} />;

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

  // Fix the data (sort, fix gap, ...)
  const data = fixLinearMetadataItems(formData, formContext.geometry);

  // Compute the JSON schema of the linear metadata item
  const jsonSchema = itemSchema(schema, registry.rootSchema);

  // Guess the value field of the linear metadata item
  const valueField = head(
    Object.keys(jsonSchema.properties || {})
      .filter((e) => !['begin', 'end'].includes(e))
      .map((e) => ({
        name: e,
        type: jsonSchema.properties ? (jsonSchema.properties[e] as JSONSchema7).type : '',
      }))
      .filter((e) => e.type === 'number' || e.type === 'integer')
      .map((e) => e.name)
  );

  /**
   * When selected element change
   * => set its data in the state
   */
  useEffect(() => {
    setSelectedData(selected !== null ? data[selected] : null);
  }, [selected]);

  return (
    <div className="linear-metadata">
      <div className="header">
        <label>{schema.title || name}</label>
      </div>
      <div className="content">
        <div className="dataviz">
          <LinearMetadataDataviz
            data={data}
            field={valueField}
            viewBox={viewBox}
            highlighted={[hovered ?? -1, selected ?? -1].filter((e) => e > -1)}
            onMouseEnter={(_e, _item, index) => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            onMouseMove={(e) => {
              if (tooltipRef.current) {
                tooltipPosition([e.nativeEvent.x, e.nativeEvent.y], tooltipRef.current);
              }
            }}
            onClick={(_e, _item, index) => {
              setSelected((old) => {
                // case when you click on the already selected item => reset
                if ((old ?? -1) === index) return null;
                else return index;
              });
              setHovered(null);
            }}
            onWheel={(e, _item, _index, point) => {
              setViewBox(getZoomedViewBox(data, viewBox, e.deltaY > 0 ? 'OUT' : 'IN', point));
            }}
            onViewBoxChange={setViewBox}
          />
          <div className="btn-group-vertical zoom">
            <button
              title="Zoom In"
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewBox(getZoomedViewBox(data, viewBox, 'IN'))}
            >
              <BiZoomIn />
            </button>
            <button
              title="Zoom Out"
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewBox(getZoomedViewBox(data, viewBox, 'OUT'))}
            >
              <BiZoomOut />
            </button>
          </div>
        </div>

        {/* Data visualisation tooltip when item is hovered */}
        {hovered !== null && (
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
                  title="Previous"
                  disabled={selected === 0}
                  onClick={() => {
                    setSelected(selected - 1);
                  }}
                >
                  <BsChevronLeft />
                </button>
                <div className="btn-group">
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    title="Fusion with left"
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
                    title="Split"
                    onClick={() => {
                      const splitPosition =
                        selectedData.begin + (selectedData.end - selectedData.begin) / 2;
                      onChange(splitAt(data, splitPosition));
                    }}
                  >
                    <BsLayoutSplit />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    title="Fusion with right"
                    disabled={selected === data.length - 1}
                    onClick={() => onChange(mergeIn(data, selected, 'right'))}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  title="Next"
                  disabled={selected === data.length - 1}
                  onClick={() => setSelected(selected + 1)}
                >
                  <BsChevronRight />
                </button>
              </div>
            </div>
            <div className="content">
              <Form
                id={`selected-${selected}`}
                widgets={widgets}
                liveValidate={true}
                schema={itemSchema(schema, registry.rootSchema, {
                  begin: {
                    minimum: selected !== 0 ? data[selected - 1].begin + 1 : 0,
                    maximum: data[selected].end - 1,
                  },
                  end: {
                    minimum: data[selected].begin + 1,
                    maximum:
                      selected !== data.length - 1 ? data[selected + 1].end - 1 : selectedData.end,
                  },
                })}
                uiSchema={{
                  begin: {
                    'ui:readonly': selected === 0,
                  },
                  end: {
                    'ui:readonly': selected === data.length - 1,
                  },
                }}
                formData={selectedData}
                onChange={(e) => setSelectedData(e.formData)}
                onSubmit={(e, reactEvent) => {
                  console.log(e, reactEvent);
                  const item = { ...e.formData };
                  let newData = [...data];
                  // we keep the old value for begin and end
                  // they will be change in the resize function if needed
                  newData[selected] = { ...newData[selected], ...omit(e, ['begin', 'end']) };

                  // Check if there is a resize
                  if (selectedData.begin !== item.begin) {
                    newData = resizeSegment(
                      [...newData],
                      selected,
                      item.begin - selectedData.begin,
                      'begin'
                    );
                  }
                  if (selectedData.end !== item.end) {
                    newData = resizeSegment(
                      [...newData],
                      selected,
                      item.end - selectedData.end,
                      'end'
                    );
                  }
                  onChange(newData);
                }}
              >
                <div className="buttons">
                  <button
                    type="button"
                    className="btn btn-outline-dark mx-1"
                    onClick={() => setSelected(null)}
                  >
                    Close
                  </button>
                  <button type="submit" className="btn btn-success" form={`selected-${selected}`}>
                    Submit
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
