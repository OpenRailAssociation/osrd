import { useState, type PropsWithChildren } from 'react';

import { Rnd } from 'react-rnd';

// Set on the body while resizing, to stop iframes from capturing the drag (see scss)
const RESIZING_CLASS = 'resizing-section';

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
        resizeHandleStyles={{
          bottom: {
            bottom: -8,
            height: 16,
          },
        }}
        onResizeStart={() => {
          setBaseHeight(height);
          document.body.classList.add(RESIZING_CLASS);
        }}
        onResize={(_e, _dir, _refToElement, delta) => {
          setHeight(baseHeight + delta.height);
        }}
        onResizeStop={() => {
          document.body.classList.remove(RESIZING_CLASS);
        }}
      >
        {children}
      </Rnd>
    </div>
  );
};

export default ResizableSection;
