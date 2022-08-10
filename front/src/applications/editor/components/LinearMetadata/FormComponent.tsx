import React, { useState, useRef, useEffect } from 'react';
import Form, { FieldProps, utils } from '@rjsf/core';
import Fields from '@rjsf/core/lib/components/fields';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { omit, head, max as fnMax, min as fnMin } from 'lodash';
import { TbZoomIn, TbZoomOut, TbZoomCancel } from 'react-icons/tb';
import { BsBoxArrowInLeft, BsBoxArrowInRight, BsChevronLeft, BsChevronRight } from 'react-icons/bs';
import { IoIosCut } from 'react-icons/io';
import { MdOutlineHelpOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import Modal from '../Modal';
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
  const [isHelpOpened, setIsHelpOpened] = useState<boolean>(false);

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
    setIsHelpOpened(false);
    setData(formData);
    setSelected((old) => (old && !!formData[old] ? null : old));
    setHovered((old) => (old && !!formData[old.index] ? null : old));
  }, [formData]);

  /**
   * When selected element change
   * => set its data in the state
   * => recompute viewbox so selected element is always visible ()
   */
  useEffect(
    () => {
      setSelectedData(selected !== null && data[selected] ? data[selected] : null);
    },
    // The "data" is omitted here, otherwise it is always refreshed
    [selected, data]
  );

  if (!jsonSchema) return <Fields.ArrayField {...props} />;
  return (
    <div className="linear-metadata">
      <div className="header">
        <h4 className="control-label m-0">{schema.title || name}</h4>
        <button
          type="button"
          className="btn btn-unstyled p-1 ml-1"
          title={t('common.help-display')}
          onClick={() => setIsHelpOpened(true)}
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
                }, 150) as number;
                setClickTimeout(timer);
              }
            }}
            onDoubleClick={(_e, _item, _index, point) => {
              if (clickTimeout) clearTimeout(clickTimeout);
              setClickPrevent(true);
              const newData = splitAt(data, point);
              onChange(newData);
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
                const result = resizeSegment(formData, index, gap, 'end');
                if (finalized) onChange(result.result);
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
              <TbZoomIn />
            </button>
            <button
              title={t('common.zoom-reset')}
              type="button"
              disabled={viewBox === null}
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setViewBox(null)}
            >
              <TbZoomCancel />
            </button>
            <button
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
              schema={jsonSchema}
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

      {isHelpOpened && (
        <Modal onClose={() => setIsHelpOpened(false)} title={t('common.help')}>
          <p>{t('Editor.linear-metadata.help')}</p>
        </Modal>
      )}
    </div>
  );
};

export default FormComponent;
