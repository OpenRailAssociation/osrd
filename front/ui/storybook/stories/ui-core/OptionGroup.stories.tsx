import React, { useRef, useState } from 'react';

import { OptionGroup, type OptionGroupSection } from '@osrd-project/ui-core';
import {
  ChevronDown,
  PatternDaily,
  PatternHourly,
  PatternWeekly,
  TimetableCalendar,
} from '@osrd-project/ui-icons';
import { type Meta, type StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

type Timetable = { id: string; name: string };

const sections: OptionGroupSection<Timetable>[] = [
  {
    title: 'Hourly patterns',
    icon: <PatternHourly size="lg" />,
    items: [
      { value: { id: 'hourly-1', name: 'Hourly pattern #1' }, label: 'Hourly pattern #1' },
      { value: { id: 'hourly-2', name: 'Hourly pattern #2' }, label: 'Hourly pattern #2' },
      {
        value: { id: 'hourly-3', name: 'Hourly pattern way too long' },
        label: 'Hourly pattern way too long',
      },
    ],
  },
  {
    title: 'Daily patterns',
    icon: <PatternDaily size="lg" />,
    items: [
      { value: { id: 'daily-1', name: 'Weekday' }, label: 'Weekday' },
      { value: { id: 'daily-2', name: 'Weekend' }, label: 'Weekend' },
      { value: { id: 'daily-3', name: 'Public holidays' }, label: 'Public holidays' },
    ],
  },
  {
    title: 'Weekly patterns',
    icon: <PatternWeekly size="lg" />,
    items: [{ value: { id: 'weekly-1', name: 'Weekly pattern #1' }, label: 'Weekly pattern #1' }],
  },
  {
    title: 'Calendars',
    icon: <TimetableCalendar size="lg" />,
    items: [{ value: { id: 'calendar-1', name: 'Calendar #1' }, label: 'Calendar #1' }],
  },
];

const findSectionIcon = (itemId: string) =>
  sections.find((section) => section.items.some((item) => item.value.id === itemId))?.icon;

const OptionGroupWrapper = () => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Timetable>(sections[0].items[0].value);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        {!isOpen && findSectionIcon(selected.id)}
        {selected.name}
        <ChevronDown size="sm" />
      </button>
      <OptionGroup
        triggerRef={triggerRef}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sections={sections}
        selectedValue={selected}
        onSelect={setSelected}
        getItemKey={(timetable) => timetable.id}
      />
    </div>
  );
};

const meta: Meta<typeof OptionGroupWrapper> = {
  component: OptionGroupWrapper,
  title: 'Core/OptionGroup',
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof OptionGroupWrapper>;

export const Default: Story = {};
