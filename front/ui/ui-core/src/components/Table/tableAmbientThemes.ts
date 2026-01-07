export type AmbientVariant = 'A' | 'B' | 'C' | 'D';

export const colors = {
  ambientA5: 'rgb(246, 248, 249)',
  ambientA10: 'rgb(239, 243, 245)',
  ambientA15: 'rgb(233, 239, 242)',
  ambientB5: 'rgb(250, 249, 245)',
  ambientB10: 'rgb(247, 246, 238)',
  ambientB15: 'rgb(242, 240, 228)',
  ambientC5: 'rgb(246, 249, 246)',
  ambientC10: 'rgb(240, 244, 241)',
  ambientC15: 'rgb(234, 240, 235)',
  ambientD5: 'rgb(248, 247, 253)',
  ambientD10: 'rgb(244, 243, 252)',
  ambientD15: 'rgb(239, 237, 247)',
  blackAlpha: 'rgba(0, 0, 0)',
};

export const TABLE_AMBIENT_THEMES: Record<
  AmbientVariant,
  {
    mix1: string;
    mix2: string;
    odd: string;
    even: string;
  }
> = {
  A: {
    mix1: colors.blackAlpha,
    mix2: colors.ambientA5,
    odd: colors.ambientA10,
    even: colors.ambientA15,
  },
  B: {
    mix1: colors.blackAlpha,
    mix2: colors.ambientB5,
    odd: colors.ambientB10,
    even: colors.ambientB15,
  },
  C: {
    mix1: colors.blackAlpha,
    mix2: colors.ambientC5,
    odd: colors.ambientC10,
    even: colors.ambientC15,
  },
  D: {
    mix1: colors.blackAlpha,
    mix2: colors.ambientD5,
    odd: colors.ambientD10,
    even: colors.ambientD15,
  },
};
