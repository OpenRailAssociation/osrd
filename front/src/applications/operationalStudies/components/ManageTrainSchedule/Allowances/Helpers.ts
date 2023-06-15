import { AllowanceValue } from 'common/api/osrdEditoastApi';

export default function getAllowanceValue(value?: AllowanceValue) {
  switch (value?.value_type) {
    case 'time_per_distance':
      return value.minutes || 0;
    case 'time':
      return value.seconds || 0;
    case 'percentage':
      return value.percentage || 0;
    default:
      return 0;
  }
}
