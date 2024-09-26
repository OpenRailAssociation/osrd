// TODO: Remove undefined when osrd-ui's value type is optional
type SelectFixedOption =
  | {
      label: string;
      id: string;
    }
  | undefined;

// Utility to create standardized options for <Select> components.
// `getOptionLabel`: Displays the option or a placeholder if empty.
// `getOptionValue`: Uses the option itself as the value.
export const createStringSelectOptions = (opts: string[]) => ({
  options: opts,
  getOptionLabel: (option: string) => option,
  getOptionValue: (option: string) => option,
});

// Utility function for handling fixed label-value object arrays
// structure may vary, and custom label/value mappings are needed.
export const createFixedSelectOptions = (opts: SelectFixedOption[]) => ({
  options: opts,
  getOptionLabel: (option: SelectFixedOption) => option?.label ?? '',
  getOptionValue: (option: SelectFixedOption) => option?.id ?? '',
});
