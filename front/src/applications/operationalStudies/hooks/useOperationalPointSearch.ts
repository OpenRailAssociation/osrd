import { useCallback, useEffect, useState } from 'react';

import { uniqBy } from 'lodash';

import {
  osrdEditoastApi,
  type SearchPayload,
  type SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import { useDebounce } from 'utils/hooks/useDebounce';
import { splitTokens, toUpper } from 'utils/strings';

import { rankSuggestions, markSuggestions } from '../helpers/rankingSuggestions';
import {
  largePayload,
  exactTrigramPayload,
  multiPayloadFromTokens,
} from '../helpers/searchPayload';
import { selectSecondaryCode, shouldKeepMainCodeLock } from '../helpers/suggestionMatchers';
import { buildOpSuggestion } from '../views/Scenario/components/ManageTrainSchedule/helpers/buildOpSuggestion';
import type { OperationalPointSuggestion } from '../views/Scenario/components/ManageTrainSchedule/Itinerary/ComboBoxCustomList/ListElementComponent';

type Params = {
  pageSize?: number;
  minChars?: number;
  debounceMs?: number;
};

export const useOperationalPointSearch = ({
  pageSize = 1000,
  minChars = 2,
  debounceMs = 300,
}: Params) => {
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useLazyQuery();
  const [activeStepKey, setActiveStepKey] = useState<string | null>(null);
  const [draftByStepKey, setDraftByStepKey] = useState<Record<string, string>>({});
  const [displayByStepKey, setDisplayByStepKey] = useState<Record<string, string>>({});
  const [isEditingByStepKey, setIsEditingByStepKey] = useState<Record<string, boolean>>({});
  const activeDraft = activeStepKey ? (draftByStepKey[activeStepKey] ?? '') : '';
  const isEditingActive = activeStepKey ? (isEditingByStepKey[activeStepKey] ?? true) : true;
  const rawActiveInput = isEditingActive ? activeDraft : '';
  const debouncedRawInput = useDebounce(rawActiveInput, debounceMs);
  const debouncedTrimmedInput = debouncedRawInput.trim();
  const setInputForStep = useCallback((stepId: string, value: string) => {
    setIsEditingByStepKey((prev) => ({ ...prev, [stepId]: true }));
    setDraftByStepKey((prev) => ({ ...prev, [stepId]: value }));
  }, []);

  const getInputForStep = useCallback(
    (stepId: string) => {
      const isEditing = isEditingByStepKey[stepId] ?? true;
      return isEditing ? draftByStepKey[stepId] : displayByStepKey[stepId];
    },
    [draftByStepKey, displayByStepKey, isEditingByStepKey]
  );

  const [opSuggestions, setOpSuggestions] = useState<OperationalPointSuggestion[]>([]);

  const [searchTrigger, setSearchTrigger] = useState(0);

  const infraId = useInfraID();

  const reopenSuggestionsForStep = useCallback(
    (stepId: string, queryValue = '') => {
      setActiveStepKey(stepId);

      setIsEditingByStepKey((prev) => ({ ...prev, [stepId]: true }));

      setDraftByStepKey((prev) => {
        const currentDraft = prev[stepId] ?? '';
        if (currentDraft !== '') return prev;

        const display = displayByStepKey[stepId] ?? '';
        const next = display !== '' ? display : queryValue;

        return { ...prev, [stepId]: next };
      });

      setSearchTrigger((n) => n + 1);
    },
    [displayByStepKey]
  );

  const resetOpSuggestions = useCallback(() => setOpSuggestions([]), []);

  const commitSelectionForStep = useCallback((stepId: string, display: string) => {
    setDisplayByStepKey((prev) => ({ ...prev, [stepId]: display }));
    setDraftByStepKey((prev) => ({ ...prev, [stepId]: '' }));
    setIsEditingByStepKey((prev) => ({ ...prev, [stepId]: false }));
    setOpSuggestions([]);
  }, []);

  const startEditingForStep = useCallback((stepId: string) => {
    setIsEditingByStepKey((prev) => ({ ...prev, [stepId]: true }));
  }, []);

  const chooseChForSuggestion = useCallback(
    (stepId: string, suggestion: OperationalPointSuggestion, forcedCh?: string) => {
      const rawInput = draftByStepKey[stepId] ?? '';
      return selectSecondaryCode(suggestion, rawInput, forcedCh);
    },
    [draftByStepKey]
  );

  const formatChosenValue = useCallback(
    (s: OperationalPointSuggestion, secondaryCode: string) => `${s.name} ${secondaryCode}`,
    []
  );

  useEffect(() => {
    if (!activeStepKey) return;

    if (!debouncedTrimmedInput || debouncedTrimmedInput.length < minChars) {
      resetOpSuggestions();
      return;
    }

    let cancelled = false;

    const tokens = splitTokens(debouncedTrimmedInput);
    const firstTokenUpper = toUpper(tokens[0] ?? '');

    const apply = (sugs: OperationalPointSuggestion[]) => {
      const ranked = rankSuggestions(sugs, debouncedRawInput);
      const marked = markSuggestions(ranked, debouncedRawInput);
      setOpSuggestions(marked);
    };

    const search = async (searchPayload: SearchPayload) =>
      (await postSearch({
        searchPayload,
        pageSize,
      }).unwrap()) as SearchResultItemOperationalPoint[];

    const searchOps = async () => {
      // 1) Large call on the entire query
      const largeRes = await search(largePayload(infraId, debouncedTrimmedInput));
      if (cancelled) return;

      const suggestionsLarge = buildOpSuggestion(largeRes);

      // 2) We try to lock trigram from the "large" call
      if (firstTokenUpper) {
        const keptFromLarge = suggestionsLarge.filter(
          (s) => toUpper(s.mainCode) === firstTokenUpper && shouldKeepMainCodeLock(s, tokens)
        );

        if (keptFromLarge.length > 0) {
          apply(suggestionsLarge);
          return;
        }
      }

      // 3) Fallback: exact trigram via a dedicated call (when the large one doesn't return it)
      // We "lock" only if the rest is coherent, otherwise we relaunch a normal call.
      if (firstTokenUpper) {
        const exactRes = await search(exactTrigramPayload(infraId, firstTokenUpper));
        if (cancelled) return;

        if (exactRes.length > 0) {
          const suggestionsExact = buildOpSuggestion(exactRes);
          const keptExact = suggestionsExact.filter((s) => shouldKeepMainCodeLock(s, tokens));

          if (keptExact.length > 0) {
            apply(uniqBy([...keptExact, ...suggestionsExact, ...suggestionsLarge], 'id'));
            return;
          }
        }
      }

      if (tokens.length > 1) {
        const multiRes = await search(multiPayloadFromTokens(infraId, tokens));
        if (cancelled) return;

        if (multiRes) {
          const multiSuggestions = buildOpSuggestion(multiRes);
          apply(uniqBy([...suggestionsLarge, ...multiSuggestions], 'id'));
          return;
        }
      }

      apply(suggestionsLarge);
    };

    searchOps();

    return () => {
      cancelled = true;
    };
  }, [
    activeStepKey,
    debouncedRawInput,
    debouncedTrimmedInput,
    infraId,
    postSearch,
    buildOpSuggestion,
    pageSize,
    minChars,
    resetOpSuggestions,
    searchTrigger,
  ]);

  return {
    activeStepKey,
    setActiveStepKey,
    getInputForStep,
    setInputForStep,
    opSuggestions,
    resetOpSuggestions,
    formatChosenValue,
    commitSelectionForStep,
    startEditingForStep,
    chooseChForSuggestion,
    reopenSuggestionsForStep,
  };
};
