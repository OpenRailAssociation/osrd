import React, { useCallback, useMemo, useRef, useState } from 'react';

import cx from 'classnames';

import FieldWrapper from './FieldWrapper';

type UnitConfig = {
  key: string;
  label: string;
  msPerUnit: number;
  digits: number;
};

export type UnitProps = 'h' | 'm' | 's' | 'ms' | UnitConfig;

type UnitSetting = UnitConfig & {
  max: number;
  padChar: string;
};

export type DurationInputProps = {
  id: string;
  units: UnitProps[];
  value: number;
  padChar: string;
  onChange?: (ms: number) => void;
  max: number;
  small?: boolean;
  hint?: string;
  label?: string;
} & Omit<React.ComponentPropsWithoutRef<'div'>, 'onChange'>;

const PRESETS: Record<string, Omit<UnitConfig, 'key'>> = {
  h: { label: 'h', digits: 2, msPerUnit: 3_600_000 },
  m: { label: 'm', digits: 2, msPerUnit: 60_000 },
  s: { label: 's', digits: 2, msPerUnit: 1_000 },
  ms: { label: 'ms', digits: 3, msPerUnit: 1 },
};

function normalizeUnits(units: UnitProps[], padChar: string, max: number): UnitSetting[] {
  const configs: UnitConfig[] = units.map((u) => {
    if (typeof u === 'string') {
      return { key: u, ...PRESETS[u] };
    }

    const key = (u.key ?? u.label)!;
    const base = PRESETS[key] ?? {};

    return {
      key,
      label: u.label ?? base.label ?? key,
      msPerUnit: u.msPerUnit ?? base.msPerUnit ?? 1,
      digits: u.digits ?? base.digits ?? 2,
    };
  });

  configs.sort((a, b) => b.msPerUnit - a.msPerUnit);
  return configs.map((unit, idx) => {
    const prev = idx > 0 ? configs[idx - 1] : null;
    return {
      ...unit,
      digits: prev ? unit.digits : String(Math.floor(max / unit.msPerUnit)).length,
      max: prev ? Math.floor(prev.msPerUnit / unit.msPerUnit) : Infinity,
      padChar,
    };
  });
}

type FormattedValues = Record<string, string>;

function toUnitField(ms: number, unit: UnitSetting): [string, string] {
  const value = Math.floor(ms / (unit.msPerUnit || 1)) % unit.max;
  return [unit.key, String(value || unit.padChar).padStart(unit.digits, unit.padChar)];
}

function toFormattedValues(units: UnitSetting[], ms: number): FormattedValues {
  return Object.fromEntries(units.map((u) => toUnitField(ms, u)));
}

function toTotalMilliseconds(fields: UnitSetting[], values: FormattedValues): number {
  return fields.reduce((acc, f) => {
    const cleaned = values[f.key].replace(/[^0-9]/g, '');
    const value = parseInt(cleaned, 10) || 0;
    return acc + value * (f.msPerUnit || 1);
  }, 0);
}

function useDurationInput({
  units,
  value,
  onChange,
  padChar,
  max,
}: Omit<DurationInputProps, 'id'>) {
  const fields = useMemo(() => normalizeUnits(units, padChar, max), [units, padChar, max]);
  const inputRefs = useRef<Record<string, HTMLInputElement>>({});

  const [initialValue, setInitialValue] = useState(value);
  const [formattedValues, setFormattedValues] = useState<FormattedValues>(() =>
    toFormattedValues(fields, Math.min(max, value))
  );

  if (initialValue !== value) {
    setInitialValue(value);
    setFormattedValues(toFormattedValues(fields, Math.min(max, value)));
  }

  const focusField = useCallback((key: string) => {
    requestAnimationFrame(() => {
      inputRefs.current[key]?.focus();
      inputRefs.current[key]?.select();
    });
  }, []);

  const focusNext = useCallback(
    (currentKey: string) => {
      const idx = fields.findIndex((f) => f.key === currentKey);
      const next = fields[idx + 1];
      if (next) focusField(next.key);
    },
    [fields, focusField]
  );

  const focusPrevious = useCallback(
    (currentKey: string) => {
      const idx = fields.findIndex((f) => f.key === currentKey);
      const previous = fields[idx - 1];
      if (previous) focusField(previous.key);
    },
    [fields, focusField]
  );

  const handleChange = useCallback(
    (setting: UnitSetting, inputValue: string) => {
      const cleaned = inputValue.replace(/[^0-9]/g, '').slice(0, setting.digits);
      setFormattedValues((prev) => ({ ...prev, [setting.key]: cleaned }));
      if (cleaned.length === setting.digits) {
        focusNext(setting.key);
      }
    },
    [focusNext]
  );

  const handleKeyDown = useCallback(
    (setting: UnitSetting, e: React.KeyboardEvent<HTMLInputElement>) => {
      const input = e.currentTarget;

      if (!input) return;

      if (e.key === 'ArrowRight' && input.selectionStart === input.value.length) {
        e.preventDefault();
        focusNext(setting.key);
      }

      if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
        e.preventDefault();
        focusPrevious(setting.key);
      }
    },
    [focusNext, focusPrevious]
  );

  const handleFocus = useCallback((setting: UnitSetting) => focusField(setting.key), [focusField]);

  const handleBlur = useCallback(() => {
    const ms = toTotalMilliseconds(fields, formattedValues);
    const clamped = Math.min(max, ms);
    const next = toFormattedValues(fields, clamped);
    setFormattedValues(next);
    onChange?.(toTotalMilliseconds(fields, next));
  }, [fields, formattedValues, max, onChange]);

  return {
    fields,
    formattedValues,
    inputRefs,
    handleChange,
    handleFocus,
    handleBlur,
    handleKeyDown,
  };
}

type UnitFieldProps = {
  setting: UnitSetting;
  value: string;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  tabIndex: number;
};

const UnitField = function UnitField({
  setting,
  value,
  inputRef,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  tabIndex,
}: UnitFieldProps) {
  const { label, digits, padChar } = setting;
  const placeholder = padChar.repeat(digits);

  return (
    <span className="unit-field">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        style={{
          width: `${digits}ch`,
        }}
        tabIndex={tabIndex}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <span aria-hidden onClick={onFocus}>
        {label}
      </span>
    </span>
  );
};

/**
 * Duration units can be set up via their shorthand strings (h, m, s, ms)
 * or more precisely through objects.
 * The value of the component is a number representing the milliseconds of the duration.
 */
const DurationInput = ({
  id,
  units = ['m', 's'],
  value = 0,
  onChange,
  padChar = '0',
  small = false,
  max = 99 * 3_600_000, // 99 HOURS
  label,
  hint,
  ...rest
}: DurationInputProps) => {
  const {
    fields,
    formattedValues,
    inputRefs,
    handleChange,
    handleFocus,
    handleBlur,
    handleKeyDown,
  } = useDurationInput({
    units,
    value,
    onChange,
    padChar,
    max,
  });

  return (
    <FieldWrapper id={id} label={label} hint={hint} small={small}>
      <div
        className={cx('ui-duration-input', { small })}
        role="group"
        aria-label="Duration Input"
        onClick={() => inputRefs.current[fields[0].key]?.focus()}
        {...rest}
      >
        {fields.map((setting, idx) => (
          <UnitField
            key={setting.key}
            setting={setting}
            value={formattedValues[setting.key]}
            inputRef={(el) => {
              if (el) inputRefs.current[setting.key] = el;
            }}
            tabIndex={idx === 0 ? 0 : -1}
            onChange={(val) => handleChange(setting, val)}
            onFocus={() => handleFocus(setting)}
            onBlur={() => handleBlur()}
            onKeyDown={(e) => handleKeyDown(setting, e)}
          />
        ))}
      </div>
    </FieldWrapper>
  );
};

export default DurationInput;
