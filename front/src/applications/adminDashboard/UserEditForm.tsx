import { useReducer } from 'react';

import { CheckboxesTree, Input, Select } from '@osrd-project/ui-core';
import { NoEntry } from '@osrd-project/ui-icons';
import { v4 as uuidv4 } from 'uuid';

import { osrdEditoastApi, type Role } from 'common/api/osrdEditoastApi';

import './styles/user-edit-form.css';

type Identity = `${string}/${string}`;

type InfoInputProps = {
  identities: Identity[];
  providerList: string[];
  name: string;
};

function GroupsInput() {
  'use memo';
  let { data: groups } = osrdEditoastApi.endpoints.getAuthzGroups.useQuery();
  if (groups) {
    groups = groups.toSorted((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="user-edit-groups-input">
      <CheckboxesTree
        id="admin-dashboard-groups-input"
        label="Groups"
        items={(groups || []).map(({ id, name }) => ({
          id,
          props: { label: name, checked: false },
        }))}
        onChange={() => {}}
      />
    </div>
  );
}

function RolesInput({ roles, onChange }: { roles: Role[]; onChange: (roles: Role[]) => void }) {
  'use memo';
  return (
    <CheckboxesTree
      id="admin-dashboard-roles-input"
      label="Roles"
      items={['Stdcm', 'OperationalStudies', 'Admin'].map((role_value, index) => {
        const role: Role = role_value as Role;
        return {
          id: index,
          props: { label: role, checked: roles.includes(role) },
        };
      })}
      onChange={(checkedItems) => {
        const newRoles = checkedItems.map((item) => item.props.label as Role);
        onChange(newRoles);
      }}
    />
  );
}

function IdentityInput({
  key,
  providerList,
  provider,
  identifier,
  deletable,
  conflict,
  onChange,
  onDelete,
}: {
  key: string;
  providerList: InfoInputProps['providerList'];
  provider?: string;
  identifier: string;
  deletable: boolean;
  conflict: boolean;
  onChange: (identity: { provider?: string; identifier: string }) => void;
  onDelete: () => void;
}) {
  'use memo';
  return (
    <div className="identity-input">
      <Select
        id={`admin-dashboard-provider-${key}`}
        value={provider}
        options={providerList}
        placeholder="Choose"
        narrow={true}
        getOptionLabel={(x) => x}
        getOptionValue={(x) => x}
        onChange={(p) => {
          onChange({ provider: p, identifier });
        }}
      />
      <Input
        id={`admin-dashboard-identity-${key}`}
        narrow={true}
        value={identifier}
        onChange={(e) => onChange({ provider, identifier: e.target.value })}
        statusWithMessage={conflict ? { status: 'error' } : undefined}
      />
      {deletable && (
        <button type="button" className="delete-identity-button" onClick={onDelete}>
          <NoEntry size="sm" />
        </button>
      )}
    </div>
  );
}

type InfoInputState = {
  conflict: boolean;
  identities: {
    key: string;
    provider?: string;
    identifier: string;
    conflict: boolean;
  }[];
};

function deriveState(
  identities: {
    key: string;
    provider?: string;
    identifier: string;
  }[]
): InfoInputState {
  let globalConflict = false;
  const identityMap = new Map<string, number>();
  for (const { provider, identifier } of identities) {
    const mapKey = `${provider}@${identifier}`;
    const existingCount = identityMap.get(mapKey) ?? 0;
    if (existingCount > 0) {
      globalConflict = true;
    }
    identityMap.set(mapKey, existingCount + 1);
  }
  return {
    conflict: globalConflict,
    identities: identities.map(({ key, provider, identifier }) => {
      const mapKey = `${provider}@${identifier}`;
      return {
        key,
        provider,
        identifier,
        conflict: (identityMap.get(mapKey) ?? 0) > 1,
      };
    }),
  };
}

// form block
function InfoInput({ identities, providerList, name }: InfoInputProps) {
  'use memo';

  const [state, dispatch] = useReducer(
    (
      oldState,
      action
    ): {
      identities: {
        key: string;
        provider?: string;
        identifier: string;
        conflict: boolean;
      }[];
    } => {
      switch (action.type) {
        case 'new_identity':
          return deriveState([
            ...oldState.identities,
            {
              key: uuidv4(),
              provider: undefined,
              identifier: '',
            },
          ]);
        case 'update_identity': {
          const { key, provider, identifier } = action;
          return deriveState(
            oldState.identities.map((identity) =>
              identity.key === key
                ? {
                    key,
                    provider,
                    identifier,
                  }
                : identity
            )
          );
        }
        case 'delete_identity':
          return deriveState(oldState.identities.filter((identity) => identity.key !== action.key));
        default:
          throw Error(`Unhandled action type: ${action.type}`);
      }
    },
    deriveState(
      identities.map((identity) => {
        const [provider, identifier] = identity.split('/', 2);
        return { key: uuidv4(), provider, identifier };
      })
    )
  );
  const deletable = state.identities.length > 1;
  return (
    <div className="user-info-input">
      <div className="identity-input-labels">
        <span>Provider</span>
        <span>Identifier</span>
      </div>
      {state.identities.map(({ key, provider, identifier, conflict }) => (
        <IdentityInput
          key={key}
          providerList={providerList}
          provider={provider}
          identifier={identifier}
          deletable={deletable}
          conflict={conflict}
          onChange={(data) => dispatch({ type: 'update_identity', key, ...data })}
          onDelete={() => dispatch({ type: 'delete_identity', key })}
        />
      ))}
      <button type="button" onClick={() => dispatch({ type: 'new_identity' })}>
        Add an identity
      </button>
      <Input id="admin-dashboard-name-input" label="Name" value={name} />
    </div>
  );
}

export default function UserEditForm({ onCancel }: { onCancel: () => void }) {
  'use memo';
  return (
    <tr className="user-edit-form-row">
      <td colSpan={4}>
        <form className="user-edit-form">
          <InfoInput
            identities={['github/leo', 'google/leo']}
            providerList={['github', 'google', 'facebook']}
            name="Leo"
          />
          <RolesInput roles={['Stdcm', 'OperationalStudies']} onChange={() => {}} />
          <GroupsInput />
          <button onClick={onCancel}>Cancel</button>
        </form>
      </td>
    </tr>
  );
}
