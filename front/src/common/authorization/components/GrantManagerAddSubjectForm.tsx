import { useCallback, useMemo, useState } from 'react';

import { ComboBox, Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import { ThreeDots } from 'common/Loaders';
import type { AsyncStatus } from 'common/types';
import type { Subject } from 'common/useSearchUsers';
import useSearchSubject from 'common/useSearchUsers';

import type { Grant } from '../types';
import { SubjectItem } from './SubjectItem';

type AddSubjectForm = {
  subject: Subject;
  grant: Grant;
};

type GrantManagerAddSubjectFormProps = {
  grants: Array<{ label: string; value?: Grant }>;
  onSubmit(subject: Subject, grant: Grant): Promise<void>;
};
const GrantManagerAddSubjectForm = ({
  grants: grantOptions,
  onSubmit,
}: GrantManagerAddSubjectFormProps) => {
  const { t } = useTranslation();
  const [addSubjectForm, setAddSubjectForm] = useState<Partial<AddSubjectForm>>({
    grant: 'READER',
  });
  const { searchedSubjects, setSearchTerm, resetSearch } = useSearchSubject();
  const [addUserStatus, setAddUserStatus] = useState<AsyncStatus>({
    type: 'idle',
  });

  const isAddUserFormValid = useMemo(
    () => addSubjectForm.subject && addSubjectForm.grant,
    [addSubjectForm]
  );
  const searchSubmit = useCallback(async () => {
    if (isAddUserFormValid) {
      try {
        await onSubmit(addSubjectForm.subject!, addSubjectForm.grant!);
        resetSearch();
        setAddSubjectForm({});
        setAddUserStatus({ type: 'success' });
      } catch (e) {
        console.error(e);
        setAddUserStatus({ type: 'error' });
      }
    }
  }, [addSubjectForm, isAddUserFormValid, onSubmit, resetSearch]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        searchSubmit();
      }}
    >
      <div className="subject-search-section">
        <span className="subject-search-combobox">
          <ComboBox
            id="add-subject-combobox"
            value={addSubjectForm.subject}
            suggestions={searchedSubjects}
            renderListElementComponent={({ suggestion }) => <SubjectItem subject={suggestion} />}
            getSuggestionLabel={(option) => option.name}
            onChange={setSearchTerm}
            onSelectSuggestion={(suggestion) => {
              setAddSubjectForm((prev) => ({ ...prev, subject: suggestion }));
              resetSearch();
            }}
            resetSuggestions={() => resetSearch()}
            placeholder={t('authorization.searchSubject')}
            autoComplete="off"
            narrow
          />
        </span>
        <span className="subject-grant">
          <Select
            id="add-subject-grant-selector"
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value || ''}
            onChange={(option) => {
              setAddSubjectForm((prev) => ({ ...prev, grant: option?.value }));
            }}
            options={grantOptions}
            value={grantOptions.find((option) => option.value === addSubjectForm.grant)}
            narrow
          />
        </span>
      </div>
      <div className="subject-search-actions">
        <button
          type="submit"
          className="subject-search-add-button"
          disabled={addUserStatus.type === 'loading' || !isAddUserFormValid}
        >
          {addUserStatus.type === 'loading' ? <ThreeDots /> : t('common.add')}
        </button>
      </div>
    </form>
  );
};

export default GrantManagerAddSubjectForm;
