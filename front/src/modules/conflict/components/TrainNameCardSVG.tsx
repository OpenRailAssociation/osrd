type TrainNameCardSVGProps = {
  text: string;
  categoryClass: string;
};

const TrainNameCardSVG = ({ text, categoryClass }: TrainNameCardSVGProps) => {
  const fontSize = 12;

  const paddingVertical = 3;
  const paddingHorizontal = 5;

  const textWidth = text.length * 8;

  // Calculate total dimensions based on padding
  const totalWidth = textWidth + paddingHorizontal * 2;
  const totalHeight = fontSize + paddingVertical * 2;

  const cornerSize = 6;

  // Create octagon
  const segments = [
    // Top horizontal
    `M ${cornerSize},0 L ${totalWidth - cornerSize},0`,
    // Top right diagonal
    `M ${totalWidth - cornerSize},0 L ${totalWidth},${cornerSize}`,
    // Right vertical
    `M ${totalWidth},${cornerSize} L ${totalWidth},${totalHeight - cornerSize}`,
    // Bottom right diagonal
    `M ${totalWidth},${totalHeight - cornerSize} L ${totalWidth - cornerSize},${totalHeight}`,
    // Bottom horizontal
    `M ${totalWidth - cornerSize},${totalHeight} L ${cornerSize},${totalHeight}`,
    // Bottom left diagonal
    `M ${cornerSize},${totalHeight} L 0,${totalHeight - cornerSize}`,
    // Left vertical
    `M 0,${totalHeight - cornerSize} L 0,${cornerSize}`,
    // Top left diagonal
    `M 0,${cornerSize} L ${cornerSize},0`,
  ];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className={`train-name-card-svg train-category-text-${categoryClass}`}
    >
      {/* Draw each segment separately with different stroke widths */}
      {segments.map((segment, index) => {
        const isVertical = [2, 6].includes(index);

        // Due to SVG rendering limitations: 2px for vertical and 1px for diagonal/horizontal
        const strokeWidth = isVertical ? 2 : 1;

        return (
          <path
            key={index}
            d={segment}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
        );
      })}

      <text
        x={totalWidth / 2}
        y={paddingVertical + fontSize / 2 + fontSize / 3}
        textAnchor="middle"
        fill="currentColor"
        fontFamily="'IBM Plex Mono', monospace"
        fontWeight="400"
        fontSize={fontSize}
        letterSpacing="0.4px"
      >
        {text}
      </text>
    </svg>
  );
};

export default TrainNameCardSVG;
