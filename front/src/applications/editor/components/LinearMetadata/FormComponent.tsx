import React, { useState, useRef } from 'react';
import { FieldProps, utils } from '@rjsf/core';
import Fields from '@rjsf/core/lib/components/fields';
import { JSONSchema7 } from 'json-schema';
import { LineString } from 'geojson';
import { last, omit, debounce } from 'lodash';
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
import './style.scss';

function itemSchema(fieldSchema: JSONSchema7, rootSchema: JSONSchema7): JSONSchema7 {
  return utils.retrieveSchema(fieldSchema.items as JSONSchema7, rootSchema);
}

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
  // Wich segment is hovered
  const [hovered, setHovered] = useState<number | null>(null);
  // Fix the data (sort, fix gap, ...)
  const data = fixLinearMetadataItems(formData, formContext.geometry);

  return (
    <div className="linear-metadata">
      <div className="header">
        <label>{schema.title || name}</label>
      </div>
      <div className="content">
        <div className="dataviz">
          <LinearMetadataDataviz
            data={data}
            viewBox={viewBox}
            highlighted={[hovered ?? -1, selected ?? -1].filter((e) => e > -1)}
            onMouseEnter={(_e, _item, index) => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            onMouseMove={(e) => {
              if (tooltipRef.current) {
                tooltipPosition([e.nativeEvent.x, e.nativeEvent.y], tooltipRef.current);
              }
            }}
            onMouseOver={(e, _item, index) => {
              setHovered(index);
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
            <LinearMetadataTooltip
              item={data[hovered]}
              schema={itemSchema(schema, registry.rootSchema)}
            />
          </div>
        )}

        {/* Display the selection */}
        {selected !== null && (
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
                      const item = data[selected];
                      const splitPosition = item.begin + (item.end - item.begin) / 2;
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
              <Fields.SchemaField
                schema={itemSchema(schema, registry.rootSchema)}
                uiSchema={{
                  begin: {
                    'ui:widget': 'BeginEndWidget',
                    'ui:readonly': selected === 0,
                    'ui:options': {
                      min: selected !== 0 ? data[selected - 1].begin + 1 : 0,
                      max: data[selected].end - 1,
                    },
                  },
                  end: {
                    'ui:widget': 'BeginEndWidget',
                    'ui:readonly': selected === data.length - 1,
                    'ui:options': {
                      min: data[selected].begin + 1,
                      max: selected !== data.length - 1 ? data[selected + 1].end - 1 : 0,
                    },
                  },
                }}
                formData={data[selected]}
                registry={registry}
                onChange={(e) => {
                  const item = { ...e };
                  let newData = [...data];
                  // we keep the old value for begin and end
                  // they will be change in the resize function if needed
                  newData[selected] = { ...newData[selected], ...omit(e, ['begin', 'end']) };

                  // Check if there is a resize
                  if (data[selected].begin !== item.begin) {
                    newData = resizeSegment(
                      [...newData],
                      selected,
                      item.begin - data[selected].begin,
                      'begin'
                    );
                  }
                  if (data[selected].end !== item.end) {
                    newData = resizeSegment(
                      [...newData],
                      selected,
                      item.end - data[selected].end,
                      'end'
                    );
                  }
                  onChange(newData);
                }}
              />
            </div>
            <div className="footer">
              <button
                type="button"
                className="btn btn-outline-dark"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
