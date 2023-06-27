import { BsFillTrashFill } from 'react-icons/bs';
import { IoIosAdd, IoIosSave } from 'react-icons/io';
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { LinearMetadataDataviz } from 'applications/editor/components/LinearMetadata/dataviz';

import { TbZoomIn, TbZoomOut, TbZoomCancel, TbScissors, TbArrowsHorizontal } from 'react-icons/tb';

import {
  LinearMetadataItem,
  createSegmentAt,
  fixLinearMetadataItems,
  getLineStringDistance,
  getZoomedViewBox,
  removeSegment,
  resizeSegment,
  splitAt,
  transalteViewBox,
} from 'applications/editor/components/LinearMetadata';

import { FieldProps } from '@rjsf/core';
import { isNil, max as fnMax, cloneDeep } from 'lodash';

import { tooltipPosition, notEmpty } from 'applications/editor/components/LinearMetadata/utils';
import { ValueOf } from 'utils/types';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
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
  showValues?: boolean;
};

type IntervalsEditorMetaProps = {
  params?: IntervalsEditorParams;
  valueField: string;
  values?: string[];
  defaultValue?: number;
  units?: string[];
  defaultUnit?: string;
  onChange: (newData: LinearMetadataItem[]) => void;
};

type IntervalsEditorProps = IntervalsEditorMetaProps & FieldProps;
/**
 * A tool to quickly set intervals on a linear range
 *
 * version 0.1
 */
export const IntervalsEditor: React.FC<IntervalsEditorProps> = (props) => {
  const {
    name,
    formContext,
    formData,
    onChange,
    params,
    valueField,
    units,
    defaultUnit,
    values,
    defaultValue,
  } = props;
  // Wich segment area is visible
  const [viewBox, setViewBox] = useState<[number, number] | null>(null);
  // Ref for the tooltip
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  // Wich segment is hovered
  const [hovered, setHovered] = useState<{ index: number; point: number } | null>(null);
  // Mode of the dataviz
  const [mode, setMode] = useState<'dragging' | 'resizing' | 'creating' | null>(null);

  // Fix the data (sort, fix gap, ...)
  const [data, setData] = useState<Array<LinearMetadataItem>>(formData);

  // Wich segment is selected
  const [selected, setSelected] = useState<number | null>(null);
  // For mouse click / doubleClick
  const [clickTimeout, setClickTimeout] = useState<number | null>(null);
  const [clickPrevent, setClickPrevent] = useState<boolean>(false);
  const [selectedTool, setSelectedTool] = useState<ValueOf<typeof TOOLS> | null>(null);

  const { t } = useTranslation();

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

  /**
   * Main Callback: the wrapper will recieve a list on intervals with values
   */
  const customOnChange = useCallback(
    (newData: Array<LinearMetadataItem>) => {
      onChange(newData.filter((e) => (valueField ? !isNil(e[valueField]) : true)));
    },
    [onChange, valueField]
  );

  /**
   * Resize segment after specific input (it does not trigger a callback for controlled input behavior, we choosed to let the user manually confirm it)
   */
  const resizeSegmentByInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, context: 'begin' | 'end') => {
      if (!isNil(selected)) {
        const gap = parseFloat(e.target.value) - data[selected][context];
        const result = resizeSegment(data, selected, gap, context);
        setData(result.result);
      }
    },
    [selected]
  );

  const toggleSelectedTool = (tool: symbol) => {
    setSelectedTool(selectedTool === tool ? null : tool);
  };

  const dataVizParams = useMemo(
    () => ({ ticks: true, stringValues: isNil(units), showValues: params?.showValues }),
    [params]
  );

  return (
    <div className="linear-metadata">
      <div className="header">
        <div>
          <h4 className="control-label m-0">{`${name} ${valueField} ${
            units ? ' (' : ''
          }${units?.join(' / ')}${units ? ')' : ''}`}</h4>
        </div>
        <div>
          <div className="zoom-horizontal">
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
                console.warn(e);
              }
            }}
            onCreate={(finalized) => {
              setMode(!finalized ? 'creating' : null);
              let newIntervalIndex = null;
              try {
                let result = cloneDeep(data);
                if (hovered && selectedTool === TOOLS.addTool) {
                  const filteredCurrentResults = result.filter((e) =>
                    valueField ? !isNil(e[valueField]) : true
                  );
                  result = createSegmentAt(
                    filteredCurrentResults,
                    hovered.point - 1,
                    hovered.point,
                    distance,
                    {
                      fieldName: valueField,
                      defaultValue: defaultValue || (values ? '' : 0),
                      tagNew: true,
                    }
                  );
                  toggleSelectedTool(TOOLS.addTool);

                  newIntervalIndex = result.findIndex((intervalCloned) => intervalCloned.new);
                  delete result[newIntervalIndex].new;
                  setData(result);
                }
                customOnChange(result);
              } catch (e) {
                // TODO: should we display it ?
                console.warn(e);
              }
              return newIntervalIndex;
            }}
            params={dataVizParams}
          />
          <div className="btn-group-vertical">
            <div className="tools">
              {params?.addTool && (
                <button
                  className={`${
                    selectedTool === TOOLS.addTool ? 'btn-selected' : 'btn'
                  } btn-sm btn-outline-secondary`}
                  type="button"
                  title={t('common.add')}
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
                  title={t('common.pan')}
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
                  title={t('common.select')}
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
                  title={t('common.delete')}
                  disabled={selected === data.length - 1}
                  onClick={() => {
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
            <IntervalsEditorTootlip item={data[hovered.index]} point={hovered.point} />
          </div>
        )}

        {/* Flex dedicated edition */}
        {!isNil(selected) && data[selected] && (
          <div className="flexValuesEdition">
            <div className="flexValues">
              <div>
                <InputSNCF
                  type="number"
                  id="item-begin"
                  label={t('begin')}
                  onChange={(e) => {
                    resizeSegmentByInput(e, 'begin');
                  }}
                  max={data[selected].end}
                  value={data[selected].begin}
                  isFlex
                  noMargin
                  sm
                />
                <InputSNCF
                  type="number"
                  id="item-end"
                  label={t('end')}
                  onChange={(e) => {
                    resizeSegmentByInput(e, 'end');
                  }}
                  min={data[selected].begin}
                  value={data[selected].end}
                  isFlex
                  noMargin
                  sm
                />
              </div>
              <div>
                {values && values.length > 1 ? (
                  <div className="flexValuesEditionSelect">
                    <SelectSNCF
                      id="item-valueField"
                      options={values}
                      labelKey="label"
                      onChange={(e) => {
                        const result = cloneDeep(data);
                        if (result && result[selected]) {
                          result[selected][valueField] = e.target.value;
                          setData(result as LinearMetadataItem[]);
                        }
                      }}
                      sm
                      value={(data[selected][valueField] as string) || values[0]}
                    />
                  </div>
                ) : (
                  <InputSNCF
                    type="number"
                    id="item-valueField"
                    label={valueField}
                    onChange={(e) => {
                      const result = cloneDeep(data);
                      if (result && result[selected]) {
                        result[selected][valueField] = parseFloat(e.target.value);
                        setData(result as LinearMetadataItem[]);
                      }
                    }}
                    value={data[selected][valueField] as number}
                    noMargin
                    sm
                    isFlex
                  />
                )}
                {units && units.length > 1 && (
                  <div className="flexValuesEditionSelect">
                    <SelectSNCF
                      id="item-unit"
                      options={units}
                      labelKey="label"
                      onChange={(e) => {
                        const result = cloneDeep(data);
                        result[selected].unit = e.target.value;
                        setData(result as LinearMetadataItem[]);
                      }}
                      sm
                      value={(data[selected].unit as string) || defaultUnit}
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  customOnChange(data);
                }}
              >
                <span className="mr-2">
                  <IoIosSave />
                </span>
                {t('save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntervalsEditor;
