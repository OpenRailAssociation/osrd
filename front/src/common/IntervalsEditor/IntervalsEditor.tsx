import HelpModal from 'applications/editor/components/LinearMetadata/HelpModal';
import {
  BsBoxArrowInLeft,
  BsBoxArrowInRight,
  BsChevronLeft,
  BsChevronRight,
  BsFillTrashFill,
} from 'react-icons/bs';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LinearMetadataDataviz } from 'applications/editor/components/LinearMetadata/dataviz';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import FormBeginEndWidget from 'applications/editor/components/LinearMetadata/FormBeginEndWidget';
import LinearMetadataTooltip from 'applications/editor/components/LinearMetadata/tooltip';
import { TbZoomIn, TbZoomOut, TbZoomCancel, TbScissors } from 'react-icons/tb';
import { MdOutlineHelpOutline } from 'react-icons/md';
import {
  LinearMetadataItem,
  SEGMENT_MIN_SIZE,
  fixLinearMetadataItems,
  getFieldJsonSchema,
  getLineStringDistance,
  getZoomedViewBox,
  mergeIn,
  resizeSegment,
  splitAt,
  transalteViewBox,
  viewboxForSelection,
} from 'applications/editor/components/LinearMetadata';

import Form, { FieldProps } from '@rjsf/core';
import { JSONSchema7 } from 'json-schema';
import { isNil, omit, head, max as fnMax, min as fnMin } from 'lodash';
import { IoIosCut } from 'react-icons/io';
import { t } from 'i18next';
import { tooltipPosition, notEmpty } from 'applications/editor/components/LinearMetadata/utils';

type IntervalsEditorParams = {
  cutTool?: boolean;
  deleteTool?: boolean;
};

type IntervalsEditorMetaProps = {
  text?: string;
  params?: IntervalsEditorParams;
};

type IntervalsEditorProps = IntervalsEditorMetaProps & FieldProps;
/**
 * A tool to quickly set intervals on a linear range
 *
 * version 0.1
 */
export const IntervalsEditor: React.FC<IntervalsEditorProps> = (props) => {
  const { text, name, formContext, formData, schema, onChange, registry, params } = props;
  // Wich segment area is visible
  const [viewBox, setViewBox] = useState<[number, number] | null>(null);
  // Ref for the tooltip
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  // Wich segment is hovered
  const [hovered, setHovered] = useState<{ index: number; point: number } | null>(null);
  // Mode of the dataviz
  const [mode, setMode] = useState<'dragging' | 'resizing' | null>(null);
  // Fix the data (sort, fix gap, ...)
  const [data, setData] = useState<Array<LinearMetadataItem>>(formData);
  // Value of the selected item (needed for the its modification)
  const [selectedData, setSelectedData] = useState<LinearMetadataItem | null>(null);
  // Wich segment is selected
  const [selected, setSelected] = useState<number | null>(null);
  // For mouse click / doubleClick
  const [clickTimeout, setClickTimeout] = useState<number | null>(null);
  const [clickPrevent, setClickPrevent] = useState<boolean>(false);

  const { openModal, closeModal } = useModal();

  // Get the distance of the geometry
  const distance = useMemo(() => {
    if (!isNil(formContext.length)) {
      return formContext.length;
    }
    if (formContext.geometry?.type === 'LineString') {
      return getLineStringDistance(formContext.geometry);
    }
    return 0;
  }, [formContext]);

  const fixedData = useMemo(
    () => fixLinearMetadataItems(formData?.filter(notEmpty), distance),
    [formData, distance]
  );

  const jsonSchemaItems = {
    title: 'Curve',
    description:
      'This class is used to define the curve object.\nA curve correspond at radius of curvature in the part of corresponding track section.',
    type: 'object',
    properties: {
      begin: {
        title: 'Begin',
        description:
          'Offset in meters corresponding at the beginning of the corresponding radius in a track section ',
        minimum: 0,
        type: 'number',
        maximum: 25000,
      },
      end: {
        title: 'End',
        description:
          'Offset in meters corresponding at the end of the corresponding radius in a track section',
        minimum: 0,
        type: 'number',
        maximum: 25000,
      },
      radius: {
        title: 'Radius',
        description: 'Corresponding radius of curvature measured in meters',
        type: 'number',
      },
    },
    required: ['radius', 'begin', 'end'],
  };

  // Guess the value field of the linear metadata item
  /*
  const valueField = useMemo(() => {
    const itemProperties = (jsonSchema?.items
      ? (jsonSchema.items as JSONSchema7).properties || {}
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
  }, [jsonSchema]);
*/

  const valueField = 'gradient';

  const customOnChange = useCallback(
    (newData: Array<LinearMetadataItem>) => {
      onChange(newData.filter((e) => (valueField ? !isNil(e[valueField]) : true)));
    },
    [onChange, valueField]
  );

  return (
    <div className="linear-metadata">
      <div className="header">
        <h4 className="control-label m-0">{schema.title || name}</h4>
        <button
          type="button"
          className="btn btn-unstyled p-1 ml-1"
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
                }, 150) as number;
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
              console.log('Resizeeee');
              setMode(!finalized ? 'resizing' : null);
              try {
                console.log('Resize', index, fixedData);
                const result = resizeSegment(fixedData, index, gap, 'end');
                console.log('result', result);
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
                // TODO: should we display it ?
                console.log(e);
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
            {params?.deleteTool && (
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                title={t('common.next')}
                disabled={selected === data.length - 1}
                onClick={() => {
                  console.log('click on delete');
                }}
              >
                <TbScissors />
              </button>
            )}
          </div>
        </div>

        {/* Data visualisation tooltip when item is hovered */}
        {mode !== 'dragging' && hovered !== null && data[hovered.index] && (
          <div className="tooltip" ref={tooltipRef}>
            <LinearMetadataTooltip
              item={data[hovered.index]}
              point={!mode ? hovered.point : undefined}
              schema={jsonSchemaItems as JSONSchema7}
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
                      customOnChange(mergeIn(data, selected, 'left'));
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
                      customOnChange(newData);
                    }}
                  >
                    <IoIosCut />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
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
          </div>
        )}
      </div>
    </div>
  );
};

export default IntervalsEditor;
