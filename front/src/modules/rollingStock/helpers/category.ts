import type { TrainCategory } from 'common/api/osrdEditoastApi';

export default function isMainCategory(category: TrainCategory) {
  return 'main_category' in category;
}
