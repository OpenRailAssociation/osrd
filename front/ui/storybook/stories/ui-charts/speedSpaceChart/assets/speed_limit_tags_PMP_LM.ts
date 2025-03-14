export type SpeedLimitTags = {
  boundaries: number[];
  values: { speed_limit_tags_type: string; tag_name: string; color: string }[];
};

export const speedLimitTags: SpeedLimitTags = {
  boundaries: [0, 25000000, 65000000, 95000000, 125000000, 201649000],
  values: [
    { speed_limit_tags_type: 'tag', tag_name: 'MA100', color: '#494641' },
    { speed_limit_tags_type: 'tag', tag_name: 'EVO', color: '#216482' },
    { speed_limit_tags_type: 'tag', tag_name: 'incompatible', color: '#EAA72B' },
    {
      speed_limit_tags_type: 'tag',
      tag_name: 'UU',
      color: '#D91C1C',
    },
    { speed_limit_tags_type: 'tag', tag_name: 'missing_from_train', color: '#94918E' },
  ],
};
