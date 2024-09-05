import type { WidgetProps } from '@rjsf/utils';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

const POINT_NAME = 'point-parameter';

const CustomPosition = ({ schema, onChange, title, value }: WidgetProps) => (
  <div key={`${POINT_NAME}-${schema.description}`}>
    <p>{title}</p>
    <InputSNCF
      name={POINT_NAME}
      id={`${POINT_NAME}-${schema.description}`}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      type="number"
      min={0}
    />
  </div>
);

export default CustomPosition;
