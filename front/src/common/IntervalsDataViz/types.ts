/**
 *  Generic type for Linear Metadata
 */
export type LinearMetadataItem<T = { [key: string]: unknown }> = T & {
  begin: number;
  end: number;
};

export interface IntervalItemBaseProps<T> {
  /**
   * Boolean indicating if we are going to create a new item
   */
  creating?: boolean;

  /**
   * List of data to display (must be ordered by begin/end)
   */
  data: Array<LinearMetadataItem<T>>;

  /**
   * Value considered as empty/null (0, '' for example)
   */
  emptyValue?: unknown;

  /**
   * Name of the field on which we need to do the viz
   */
  field?: string;

  /**
   * List of elements (by begin value) that should be highlighted
   */
  highlighted: Array<number>;

  intervalType?: string;

  /**
   * Event on click on a data item
   */
  onClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when the user is creating an item
   */
  onCreate?: (point: number) => void;

  /**
   * Event on click on a data item
   */
  onDoubleClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when mouse enter into data item
   */
  onMouseEnter?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when mouse over a data item
   */
  onMouseOver?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Event when mouse wheel on a data item
   */
  onWheel?: (
    e: React.WheelEvent<HTMLDivElement>,
    item: LinearMetadataItem<T>,
    index: number,
    point: number // point on the linear metadata
  ) => void;

  /**
   * Params on dataviz behavior
   * ticks: should scale be ticked ?
   * stringValues: each interval has just a category ref, not a continuous value
   */
  options?: { resizingScale?: boolean; fullHeightItem?: boolean; showValues?: boolean };

  disableDrag?: boolean;
}

export interface OperationalPoint {
  id?: string;
  position: number;
  name?: string;
}
