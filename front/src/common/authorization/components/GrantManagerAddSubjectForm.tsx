import { useCallback, useEffect, useMemo, useState } from 'react';

import { ComboBox, Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import { ThreeDots } from 'common/Loaders';
import type { AsyncStatus } from 'common/types';
import type { Subject } from 'common/useSearchSubjects';
import useSearchSubjects from 'common/useSearchSubjects';
import { getErrorMessage } from 'utils/error';

import type { Grant } from '../types';
import { GrantSubjectItem } from './GrantSubjectItem';

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
    grant: grantOptions.length ? grantOptions[0].value : 'READER',
  });
  const { searchedSubjects, setSearchTerm, resetSearch } = useSearchSubjects();
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
        setAddUserStatus({ type: 'error', message: getErrorMessage(e) });
      }
    }
  }, [addSubjectForm, isAddUserFormValid, onSubmit, resetSearch]);

  useEffect(() => {
    // In case of an error, we display the error message for 5s
    let timer: undefined | ReturnType<typeof setTimeout>;
    if (addUserStatus.type === 'error') {
      timer = setTimeout(() => {
        setAddUserStatus({ type: 'idle' });
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [addUserStatus]);

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
            renderListElementComponent={({ suggestion }) => (
              <GrantSubjectItem subject={suggestion} />
            )}
            getSuggestionLabel={(option) => option.name}
            onChange={setSearchTerm}
            onSelectSuggestion={(suggestion) => {
              setAddSubjectForm((prev) => ({ ...prev, subject: suggestion }));
              resetSearch();
            }}
            resetSuggestions={resetSearch}
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
        {addUserStatus.type === 'error' && <span className="error">{addUserStatus.message}</span>}
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
