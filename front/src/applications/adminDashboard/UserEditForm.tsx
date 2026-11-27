import { useState } from 'react';

import { Button, CheckboxesTree, Input, Select } from '@osrd-project/ui-core';
import { NoEntry } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';

import { osrdEditoastApi, type Role } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';

import './styles/user-edit-form.css';

const PROVIDER_LABEL_ID = 'admin-dashboard-identity-label-provider';
const IDENTIFIER_LABEL_ID = 'admin-dashboard-identity-label-identifier';

type GroupId = number;

export enum UserEditFormMode {
  Add = 'add',
  Edit = 'edit',
}

export type UserEditFormState = {
  mode: UserEditFormMode;
  name: string;
  identities: {
    key: string;
    provider?: string;
    identifier: string;
  }[];
  roles: Role[];
  groups: GroupId[];
};

type InfoInputProps = Pick<UserEditFormState, 'name' | 'identities'> & {
  providerList: string[];
  conflicts: Set<string>;
  onChange: (change: Pick<UserEditFormState, 'name' | 'identities'>) => void;
};

function GroupsInput({
  selectedGroups,
  onChange,
}: {
  selectedGroups: GroupId[];
  onChange: (groups: GroupId[]) => void;
}) {
  'use memo';
  const { t } = useTranslation('admin-dashboard', { keyPrefix: 'userForm' });
  let { data: groups } = osrdEditoastApi.endpoints.getAuthzGroups.useQuery();
  if (groups) {
    groups = groups.toSorted((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="user-edit-groups-input">
      <CheckboxesTree
        id="admin-dashboard-groups-input"
        label={t('groups')}
        items={(groups || []).map(({ id, name }) => ({
          id,
          props: {
            label: name,
            small: true,
            checked: selectedGroups.includes(id),
            onChange: () => {},
          },
        }))}
        onChange={(checkedItems) =>
          onChange(checkedItems.filter((item) => item.props.checked).map((item) => item.id))
        }
      />
    </div>
  );
}

function RolesInput({ roles, onChange }: { roles: Role[]; onChange: (roles: Role[]) => void }) {
  'use memo';
  const { t } = useTranslation('admin-dashboard');
  // checks no unknown role is in the list
  const ROLES = ['Stdcm', 'OperationalStudies', 'Admin'] as const satisfies readonly Role[];
  // checks all `Role` values are in the list
  roles satisfies readonly (typeof ROLES)[number][];
  return (
    <CheckboxesTree
      id="admin-dashboard-roles-input"
      label={t('userForm.rolesLabel')}
      items={ROLES.map((role, index) => {
        const label = t(`roles.${role}`);
        return {
          id: index,
          props: { label, small: true, checked: roles.includes(role), onChange: () => {} },
        };
      })}
      onChange={(checkedItems) => {
        const newRoles = checkedItems
          .filter((item) => item.props.checked ?? false)
          .map((item) => ROLES[item.id]);
        onChange(newRoles);
      }}
    />
  );
}

function IdentityInput({
  identityKey,
  providerList,
  provider,
  identifier,
  deletable,
  conflict,
  onChange,
  onDelete,
}: {
  identityKey: string;
  providerList: InfoInputProps['providerList'];
  provider?: string;
  identifier: string;
  deletable: boolean;
  conflict: boolean;
  onChange: (identity: { provider?: string; identifier: string }) => void;
  onDelete: () => void;
}) {
  'use memo';
  const { t } = useTranslation('admin-dashboard', { keyPrefix: 'userForm' });
  return (
    <>
      <Select
        id={`admin-dashboard-provider-${identityKey}`}
        aria-labelledby={PROVIDER_LABEL_ID}
        value={provider && providerList.includes(provider) ? provider : undefined}
        options={providerList}
        placeholder={t('chooseProvider')}
        narrow={true}
        getOptionLabel={(x) => x}
        getOptionValue={(x) => x}
        onChange={(p) => {
          onChange({ provider: p, identifier });
        }}
      />
      <Input
        id={`admin-dashboard-identity-${identityKey}`}
        aria-labelledby={IDENTIFIER_LABEL_ID}
        narrow={true}
        value={identifier}
        onChange={(e) => onChange({ provider, identifier: e.target.value })}
        statusWithMessage={conflict ? { status: 'error' } : undefined}
      />
      {deletable && (
        <button
          type="button"
          className="delete-identity-button"
          aria-label={t('deleteIdentity')}
          onClick={onDelete}
        >
          <NoEntry size="sm" />
        </button>
      )}
    </>
  );
}

function detectInvalidInput(identities: UserEditFormState['identities']) {
  const firstKeyByPair = new Map<string, string>();
  const conflicts = new Set<string>();
  let incomplete = identities.length === 0;
  for (const { key, provider, identifier } of identities) {
    const ident = identifier.trim();
    if (!provider || !ident) {
      incomplete = true;
      continue;
    }

    const pair = `${provider}/${ident}`;
    const firstKey = firstKeyByPair.get(pair);
    if (firstKey === undefined) {
      firstKeyByPair.set(pair, key);
    } else {
      conflicts.add(firstKey);
      conflicts.add(key);
    }
  }
  return { conflicts, incomplete };
}

function InfoInput({ name, identities, providerList, conflicts, onChange }: InfoInputProps) {
  'use memo';

  const { t } = useTranslation('admin-dashboard', { keyPrefix: 'userForm' });
  const deletable = identities.length > 1;

  return (
    <div className="user-info-input">
      <div className="identity-input">
        <div className="identity-input-table">
          <span id={PROVIDER_LABEL_ID} className="identity-label-provider">
            {t('provider')}
          </span>
          <span id={IDENTIFIER_LABEL_ID} className="identity-label-identifier">
            {t('identifier')}
          </span>
          {identities.map(({ key, provider, identifier }) => (
            <IdentityInput
              key={key}
              identityKey={key}
              providerList={providerList}
              provider={provider}
              identifier={identifier}
              deletable={deletable}
              conflict={conflicts.has(key)}
              onChange={(data) => {
                onChange({
                  name,
                  identities: identities.map((identity) =>
                    identity.key === key ? { key, ...data } : identity
                  ),
                });
              }}
              onDelete={() => {
                onChange({
                  name,
                  identities: identities.filter((identity) => identity.key !== key),
                });
              }}
            />
          ))}
        </div>
        <button
          className="add-identity-button"
          type="button"
          onClick={() => {
            onChange({ name, identities: [...identities, { key: uuidv4(), identifier: '' }] });
          }}
        >
          {t('addIdentity')}
        </button>
      </div>
      <div className="user-name-input">
        <Input
          id="admin-dashboard-name-input"
          label={t('name')}
          value={name}
          narrow={true}
          onChange={(e) => {
            onChange({ name: e.target.value, identities });
          }}
        />
      </div>
    </div>
  );
}

type UserEditFormProps = {
  initialState: UserEditFormState;
  onSubmit: (form: UserEditFormState) => void;
  isLoading: boolean;
  onCancel: () => void;
};

export default function UserEditForm({
  initialState,
  onSubmit,
  isLoading,
  onCancel,
}: UserEditFormProps) {
  'use memo';

  const [state, setState] = useState(initialState);
  const { t } = useTranslation('admin-dashboard', { keyPrefix: 'userForm' });
  const { data: gatewayProviders } = osrdGatewayApi.endpoints.getProviders.useQuery();
  const providerValues = gatewayProviders?.map(({ provider_id }) => provider_id) ?? [];
  const { conflicts, incomplete } = detectInvalidInput(state.identities);
  const hasConflicts = conflicts.size > 0;
  const trimmedName = state.name.trim();

  return (
    <tr className="user-edit-form-row">
      <td colSpan={4}>
        <form className="user-edit-form" onSubmit={(e) => e.preventDefault()}>
          <InfoInput
            identities={state.identities}
            providerList={providerValues}
            conflicts={conflicts}
            name={state.name}
            onChange={(info) => setState({ ...state, ...info })}
          />
          <RolesInput roles={state.roles} onChange={(roles) => setState({ ...state, roles })} />
          <GroupsInput
            selectedGroups={state.groups}
            onChange={(groups) => setState({ ...state, groups })}
          />
          <div className="user-edit-form-actions">
            <Button
              label={t('cancel')}
              variant="Cancel"
              type="button"
              isDisabled={isLoading}
              onClick={onCancel}
            />
            <Button
              label={state.mode === UserEditFormMode.Add ? t('addUser') : t('saveUser')}
              type="button"
              isDisabled={incomplete || hasConflicts || !trimmedName}
              isLoading={isLoading}
              onClick={() =>
                onSubmit({
                  ...state,
                  name: trimmedName,
                  identities: state.identities.map((identity) => ({
                    ...identity,
                    identifier: identity.identifier.trim(),
                  })),
                })
              }
            />
          </div>
        </form>
      </td>
    </tr>
  );
}
