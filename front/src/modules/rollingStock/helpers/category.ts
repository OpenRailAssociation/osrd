import type { TrainCategory } from 'common/api/osrdEditoastApi';

export default function isMainCategory(category: TrainCategory | null) {
  return category === null || 'main_category' in category;
}
