import type { IconType } from 'react-icons';
import { FaTrafficLight } from 'react-icons/fa6';
import { MdFlashOn } from 'react-icons/md';
import { TbBuildingTunnel } from 'react-icons/tb';

export function getIcon(type: string): IconType {
  let result = MdFlashOn;
  switch (type) {
    case 'incompatible_electrification_ranges':
      result = MdFlashOn;
      break;
    case 'incompatible_gauge_ranges':
      result = TbBuildingTunnel;
      break;
    case 'incompatible_signalisation_system_ranges':
      result = FaTrafficLight;
      break;
    default:
      result = MdFlashOn;
  }
  return result;
}

export default getIcon;
