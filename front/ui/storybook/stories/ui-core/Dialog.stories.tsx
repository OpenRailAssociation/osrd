import React, { useState } from 'react';

import { Button, Input, Dialog, TextArea, Select } from '@osrd-project/ui-core';
import { Blocked, Search } from '@osrd-project/ui-icons';
import { type Meta, type StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

type StoryProps = {
  btnLabel: string;
  className?: string;
  header: React.ReactNode;
  body: React.ReactNode;
  footer: (setOpen: (open: boolean) => void) => React.ReactNode;
};
const Wrapper = ({ btnLabel, className, header, body, footer }: StoryProps) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)} label={btnLabel} />
      {open && (
        <Dialog className={className} header={header} footer={footer(setOpen)}>
          {body}
        </Dialog>
      )}
    </>
  );
};

const meta: Meta<typeof Wrapper> = {
  component: Wrapper,
  args: {},
  title: 'Core/Dialog',

  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Wrapper>;

export const FormDialog: Story = {
  args: {
    btnLabel: 'Dialog with form',
    className: 'ambientB',
    header: <h5>Edit local variant</h5>,
    body: (
      <form id="form" style={{ width: '406px', margin: '0 auto' }}>
        <Input id="variant" label="Variant name" type="text" defaultValue="Variant 003004" />
        <Select
          getOptionLabel={(e) => e}
          getOptionValue={(e) => e}
          id="parent"
          label="Parent train group"
          value="Group DDDEEEFFF"
          onChange={() => {}}
          options={['Group DDDEEEFFF', 'Group AAABBBCCC']}
          placeholder="Choose"
        />
        <TextArea
          id="description"
          label="Variant description"
          value="Testing more trains upstream"
        />
      </form>
    ),
    footer: (setOpen) => (
      <>
        <Button variant="Cancel" label="Cancel" onClick={() => setOpen(false)} />
        <Button type="submit" form="form" label="Edit variant" onClick={() => setOpen(false)} />
      </>
    ),
  },
};

export const FormErrorDialog: Story = {
  args: {
    btnLabel: 'Dialog with form in error',
    className: 'ambientB with-error',
    header: <h5>Edit local variant</h5>,
    body: (
      <form id="form" style={{ width: '406px', margin: '0 auto' }}>
        <p>
          The error dialog must include the `with-error` class, and the footer must conform to the
          DOM structure shown below.
        </p>
        <Input id="variant" label="Variant name" type="text" defaultValue="Variant 003004" />
        <Select
          getOptionLabel={(e) => e}
          getOptionValue={(e) => e}
          id="parent"
          label="Parent train group"
          value="Group DDDEEEFFF"
          onChange={() => {}}
          options={['Group DDDEEEFFF', 'Group AAABBBCCC']}
          placeholder="Choose"
        />
        <TextArea
          id="description"
          label="Variant description"
          value="Testing more trains upstream"
        />
      </form>
    ),
    footer: (setOpen) => (
      <>
        <div className="error">
          <Blocked variant="fill" size="lg" />
          <span>
            Network timeout error. Your message was not delivered. Please try again later. Network
            timeout error. Your message was not delivered. Please try again later. Network timeout
            error. Your message was not delivered. Please try again later.
          </span>
        </div>
        <div className="buttons">
          <Button variant="Cancel" label="Cancel" onClick={() => setOpen(false)} />
          <Button type="submit" form="form" label="Edit variant" onClick={() => setOpen(false)} />
        </div>
      </>
    ),
  },
};

export const ConfirmDialog: Story = {
  args: {
    btnLabel: 'Confirm dialog',
    className: 'ambientB',
    header: <h5>Removing a local variant</h5>,
    body: (
      <>
        <p>You&apos;re about to remove &ldquo;Variant 003004&rdquo; from this scenario.</p>
        <p style={{ color: 'var(--color-error-60)', fontWeight: '600' }}>
          This variant is local: all information it contains will be permanetly deleted.
        </p>
      </>
    ),
    footer: (setOpen) => (
      <>
        <Button variant="Cancel" label="Cancel" onClick={() => setOpen(false)} />
        <Button variant="Destructive" label="Remove from scenario" onClick={() => setOpen(false)} />
      </>
    ),
  },
};

export const ScrollingDialog: Story = {
  args: {
    btnLabel: 'Scrolling dialog',
    className: 'ambientB',
    header: <h5>Lorem ipsum</h5>,
    body: (
      <>
        {Array.from(Array(10)).map((_, index) => (
          <p key={index}>
            Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis
            egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.
            Donec eu libero sit amet quam egestas semper. Aenean ultricies mi vitae est. Mauris
            placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum
            erat wisi, condimentum sed, commodo vitae, ornare sit amet, wisi. Aenean fermentum, elit
            eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui.
            Donec non enim in turpis pulvinar facilisis. Ut felis. Praesent dapibus, neque id cursus
            faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat. Aliquam erat
            volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus
          </p>
        ))}
      </>
    ),
    footer: (setOpen) => <Button label="Close" onClick={() => setOpen(false)} />,
  },
};

export const FullscreenDialog: Story = {
  args: {
    btnLabel: 'Fullscreen dialog',
    className: 'ambientB fullscreen',
    header: <h5>Lorem ipsum</h5>,
    body: (
      <>
        {Array.from(Array(3)).map((_, index) => (
          <p key={index}>
            Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis
            egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.
            Donec eu libero sit amet quam egestas semper. Aenean ultricies mi vitae est. Mauris
            placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum
            erat wisi, condimentum sed, commodo vitae, ornare sit amet, wisi. Aenean fermentum, elit
            eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui.
            Donec non enim in turpis pulvinar facilisis. Ut felis. Praesent dapibus, neque id cursus
            faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat. Aliquam erat
            volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus
          </p>
        ))}
      </>
    ),
    footer: (setOpen) => <Button label="Close" onClick={() => setOpen(false)} />,
  },
};

export const ComplexDialog: Story = {
  args: {
    btnLabel: 'Scrolling dialog',
    className: 'ambientB',
    header: (
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h5>Lorem ipsum</h5>
        <div>
          <Input
            id="search"
            inputFieldWrapperClassname="m-0 p-0"
            trailingContent={<Search />}
            type="string"
          />
        </div>
      </div>
    ),
    body: (
      <div style={{ maxWidth: '700px' }}>
        <p>
          Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis
          egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.
          Donec eu libero sit amet quam egestas semper. Aenean ultricies mi vitae est. Mauris
          placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum
          erat wisi, condimentum sed, commodo vitae, ornare sit amet, wisi. Aenean fermentum, elit
          eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui.
          Donec non enim in turpis pulvinar facilisis. Ut felis. Praesent dapibus, neque id cursus
          faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat. Aliquam erat
          volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus
        </p>
      </div>
    ),
    footer: (setOpen) => (
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button variant="Cancel" label="Cancel" onClick={() => setOpen(false)} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'calc(var(--spacing) * 6)',
          }}
        >
          <Button variant="Cancel" label="No" onClick={() => setOpen(false)} />
          <Button variant="Primary" label="Yes" onClick={() => setOpen(false)} />
        </div>
      </div>
    ),
  },
};
