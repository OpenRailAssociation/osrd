type PowerRestrictionWarning = {
  powerRestrictionCode: string;
  electrification: string;
  begin: number;
  end: number;
};

export type PowerRestrictionWarnings = {
  invalidCombinationWarnings: PowerRestrictionWarning[];
  modeNotSupportedWarnings: Omit<PowerRestrictionWarning, 'powerRestrictionCode'>[];
  missingPowerRestrictionWarnings: {
    begin: number;
    end: number;
  }[];
};
