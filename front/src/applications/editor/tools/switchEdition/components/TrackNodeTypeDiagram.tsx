import crossing from 'assets/pictures/trackNodeTypes/crossing.svg';
import doubleSlipSwitch from 'assets/pictures/trackNodeTypes/double_slip_switch.svg';
import link from 'assets/pictures/trackNodeTypes/link.svg';
import pointSwitch from 'assets/pictures/trackNodeTypes/point_switch.svg';
import singleSlipSwitch from 'assets/pictures/trackNodeTypes/single_slip_switch.svg';

const SOURCES: Record<string, string> = {
  crossing,
  single_slip_switch: singleSlipSwitch,
  double_slip_switch: doubleSlipSwitch,
  link,
  point_switch: pointSwitch,
};

const TrackNodeTypeDiagram = ({ trackNodeType }: { trackNodeType: string }) => {
  const trackNodeTypeImage = SOURCES[trackNodeType];
  return trackNodeTypeImage && <img src={trackNodeTypeImage} alt={trackNodeType} />;
};

export default TrackNodeTypeDiagram;
