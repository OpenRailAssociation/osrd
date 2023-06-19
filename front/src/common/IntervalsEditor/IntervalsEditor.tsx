import HelpModal from 'applications/editor/components/LinearMetadata/HelpModal';
import {
  BsBoxArrowInLeft,
  BsBoxArrowInRight,
  BsChevronLeft,
  BsChevronRight,
  BsFillTrashFill,
} from 'react-icons/bs';
import { IoIosCut, IoIosAdd } from 'react-icons/io';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LinearMetadataDataviz } from 'applications/editor/components/LinearMetadata/dataviz';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';

import { TbZoomIn, TbZoomOut, TbZoomCancel, TbScissors, TbArrowsHorizontal } from 'react-icons/tb';
import { MdOutlineHelpOutline } from 'react-icons/md';
import {
  LinearMetadataItem,
  SEGMENT_MIN_SIZE,
  fixLinearMetadataItems,
  getLineStringDistance,
  getZoomedViewBox,
  mergeIn,
  removeSegment,
  resizeSegment,
  splitAt,
  transalteViewBox,
  viewboxForSelection,
} from 'applications/editor/components/LinearMetadata';

import Form, { FieldProps } from '@rjsf/core';
import { isNil, omit, head, max as fnMax, min as fnMin } from 'lodash';

import { t } from 'i18next';
import { tooltipPosition, notEmpty } from 'applications/editor/components/LinearMetadata/utils';
import { ValueOf } from 'utils/types';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import { useTranslation } from 'react-i18next';
import IntervalsEditorTootlip from './IntervalsEditorTooltip';

export const TOOLS = Object.freeze({
  cutTool: Symbol('cutTool'),
  deleteTool: Symbol('deleteTool'),
  translateTool: Symbol('translateTool'),
  addTool: Symbol('addTool'),
});

type IntervalsEditorParams = {
  cutTool?: boolean;
  deleteTool?: boolean;
  translateTool?: boolean;
  addTool?: boolean;
};

type IntervalsEditorMetaProps = {
  text?: string;
  params?: IntervalsEditorParams;
  valueField: string;
  defaultValue?: number;
  units?: string[];
  defaultUnit?: string;
};

type IntervalsEditorProps = IntervalsEditorMetaProps & FieldProps;
/**
 * A tool to quickly set intervals on a linear range
 *
 * version 0.1
 */
export const IntervalsEditor: React.FC<IntervalsEditorProps> = (props) => {
  const { name, formContext, formData, schema, onChange, params, valueField } = props;
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
  const [selectedTool, setSelectedTool] = useState<ValueOf<typeof TOOLS> | null>(null);

  const { t } = useTranslation();

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

  const customOnChange = useCallback(
    (newData: Array<LinearMetadataItem>) => {
      onChange(newData.filter((e) => (valueField ? !isNil(e[valueField]) : true)));
    },
    [onChange, valueField]
  );

  const toggleSelectedTool = (tool: symbol) => {
    setSelectedTool(selectedTool === tool ? null : tool);
  };

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
            onClick={(_e, _item, index, point) => {
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
              if (selectedTool === TOOLS.cutTool) {
                if (clickTimeout) clearTimeout(clickTimeout);
                setClickPrevent(true);
                const newData = splitAt(data, point);
                setData(newData);
                customOnChange(newData);
              }
              if (selectedTool === TOOLS.deleteTool) {
                const newData = removeSegment(data, index, distance);
                setSelected(null);
                setClickPrevent(false);
                setData(newData);
                customOnChange(newData);
              }
            }}
            onDoubleClick={(_e, _item, _index, point) => {
              if (clickTimeout) clearTimeout(clickTimeout);
              setClickPrevent(true);
              const newData = splitAt(data, point);
              setData(newData);
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
                // TODO: should we display it ?
                console.log(e);
              }
            }}
          />
          <div className="btn-group-vertical">
            <div className="zoom">
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
            <div className="tools">
              {params?.addTool && (
                <button
                  className={`${
                    selectedTool === TOOLS.addTool ? 'btn-selected' : 'btn'
                  } btn-sm btn-outline-secondary`}
                  type="button"
                  title={t('common.next')}
                  disabled={selected === data.length - 1}
                  onClick={() => {
                    toggleSelectedTool(TOOLS.addTool);
                  }}
                >
                  <IoIosAdd />
                </button>
              )}
              {params?.translateTool && (
                <button
                  className={`${
                    selectedTool === TOOLS.translateTool ? 'btn-selected' : 'btn'
                  } btn-sm btn-outline-secondary`}
                  type="button"
                  title={t('common.next')}
                  disabled={selected === data.length - 1}
                  onClick={() => {
                    toggleSelectedTool(TOOLS.translateTool);
                  }}
                >
                  <TbArrowsHorizontal />
                </button>
              )}
              {params?.cutTool && (
                <button
                  className={`${
                    selectedTool === TOOLS.cutTool ? 'btn-selected' : 'btn'
                  } btn-sm btn-outline-secondary`}
                  type="button"
                  title={t('common.next')}
                  disabled={selected === data.length - 1}
                  onClick={() => {
                    toggleSelectedTool(TOOLS.cutTool);
                  }}
                >
                  <TbScissors />
                </button>
              )}
              {params?.deleteTool && (
                <button
                  className={`${
                    selectedTool === TOOLS.deleteTool ? 'btn-selected' : 'btn'
                  } btn-sm btn-outline-secondary`}
                  type="button"
                  title={t('common.next')}
                  disabled={selected === data.length - 1}
                  onClick={() => {
                    console.log('click on delete');
                    toggleSelectedTool(TOOLS.deleteTool);
                  }}
                >
                  <BsFillTrashFill />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Data visualisation tooltip when item is hovered */}
        {mode !== 'dragging' && hovered !== null && data[hovered.index] && (
          <div className="tooltip" ref={tooltipRef}>
            <IntervalsEditorTootlip
              item={data[hovered.index]}
              point={!mode ? hovered.point : undefined}
            />
          </div>
        )}

        {/* Flex dedicated edition */}

        {selected && (
          <div className="flexValuesEdition">
            <InputSNCF
              type="text"
              id="trainlist-name"
              label={t('begin')}
              //onChange={(e) => handleChange(e.target.value)}
              value={data[selected].begin}
              noMargin
              sm
            />
            <InputSNCF
              type="text"
              id="trainlist-name"
              label={t('begin')}
              //onChange={(e) => handleChange(e.target.value)}
              value={data[selected][valueField] as number}
              noMargin
              sm
            />

            <InputSNCF
              type="text"
              id="trainlist-name"
              label={t('end')}
              //onChange={(e) => handleChange(e.target.value)}
              value={data[selected].end}
              noMargin
              sm
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default IntervalsEditor;
