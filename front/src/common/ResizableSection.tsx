import { useState, type PropsWithChildren } from 'react';

import { Rnd } from 'react-rnd';

const ResizableSection = ({
  minHeight,
  height,
  setHeight,
  children,
}: PropsWithChildren<{
  minHeight?: number;
  height: number;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
}>) => {
  const [baseHeight, setBaseHeight] = useState(height);

  return (
    <div className="resizable-section" style={{ height }}>
      <Rnd
        default={{
          x: 0,
          y: 0,
          width: '100%',
          height,
        }}
        size={{
          width: '100%',
          height,
        }}
        minHeight={minHeight}
        disableDragging
        enableResizing={{
          top: false,
          topLeft: false,
          topRight: false,
          bottomLeft: false,
          bottomRight: false,
          bottom: true,
          left: false,
          right: false,
        }}
        resizeHandleClasses={{
          bottom: 'resizable-section-handle',
        }}
        onResizeStart={() => {
          setBaseHeight(height);
        }}
        onResize={(_e, _dir, _refToElement, delta) => {
          setHeight(baseHeight + delta.height);
        }}
      >
        {children}
      </Rnd>
    </div>
  );
};

export default ResizableSection;
