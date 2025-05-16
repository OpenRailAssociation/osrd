import { useEffect, useMemo, useState } from 'react';

import { Select, ComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import useSearchOperationalPoint from 'common/Map/Search/useSearchOperationalPoint';
import { updateStdcmPathStep } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { useDebouncedFunc } from 'utils/helpers';
import { normalized } from 'utils/strings';

type StdcmOperationalPointProps = {
  location?: StdcmPathStep['location'];
  pathStepId: string;
  disabled?: boolean;
  onItineraryChange: () => void;
};

type CIOption = StdcmPathStep['location'] & { label: string; chOptions: CHOption[] };
type CHOption = { label: string; id: string; coordinates: [number, number] };

function formatChCode(chCode: string) {
  return chCode === '' ? 'BV' : chCode;
}

const getOpLabel = (op: { trigram: string; name: string }) => [op.trigram, op.name].join(' ');

const StdcmOperationalPoint = ({
  location,
  pathStepId,
  disabled,
  onItineraryChange,
}: StdcmOperationalPointProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();

  const [searchTerm, setSearchTerm] = useState('');
  const [ciSuggestions, setCiSuggestions] = useState<CIOption[]>([]);
  const [selectedCi, setSelectedCi] = useState<CIOption>();

  const { searchOperationalPoints } = useSearchOperationalPoint({
    isStdcm: true,
  });

  const searchCi = async (searchQuery: string) => {
    const searchResults = await searchOperationalPoints(searchQuery);

    const chByCi = new Map<string, CHOption[]>();
    const cis = new Map<string, Omit<CIOption, 'chOptions'>>();

    for (const op of searchResults) {
      const opName = normalized(op.name);
      if (
        (opName.startsWith(normalized(searchTerm)) ||
          opName.includes(normalized(searchTerm)) ||
          op.trigram === searchTerm.toUpperCase()) &&
        // TODO: Replace this temporary implementation with a permanent solution
        !opName.startsWith('overtake')
      ) {
        const opLabel = getOpLabel(op);
        cis.set(opLabel, {
          label: getOpLabel(op),
          trigram: op.trigram,
          uic: op.uic,
          secondary_code: op.ch,
          name: op.name,
          coordinates: op.geographic.coordinates as [number, number],
        });

        const chOption: CHOption = {
          label: formatChCode(op.ch),
          id: op.ch,
          coordinates: op.geographic.coordinates as [number, number],
        };
        if (chByCi.get(opLabel)) {
          chByCi.get(opLabel)!.push(chOption);
        } else {
          chByCi.set(opLabel, [chOption]);
        }
      }
    }

    const newCiSuggestions: CIOption[] = [];
    for (const opLabel of [...cis.keys()]) {
      newCiSuggestions.push({
        ...cis.get(opLabel)!,
        chOptions: chByCi.get(opLabel)!,
      });
    }

    return newCiSuggestions;
  };

  useDebouncedFunc(searchTerm, 150, async (searchQuery) => {
    if (!searchQuery) return;
    const locations = await searchCi(searchQuery);
    setCiSuggestions(locations);
  });

  const selectedCh = useMemo(
    () =>
      location
        ? {
            label: formatChCode(location.secondary_code),
            id: location.secondary_code,
            coordinates: location.coordinates,
          }
        : undefined,
    [location]
  );

  const handleCiSelect = (selectedSuggestion?: CIOption) => {
    dispatch(updateStdcmPathStep({ id: pathStepId, updates: { location: selectedSuggestion } }));
    onItineraryChange();
  };

  const handleChSelect = (selectedChCode?: CHOption) => {
    if (location && selectedChCode) {
      dispatch(
        updateStdcmPathStep({
          id: pathStepId,
          updates: {
            location: {
              ...location,
              secondary_code: selectedChCode.id,
              coordinates: selectedChCode.coordinates,
            },
          },
        })
      );
      onItineraryChange();
    }
  };

  const onBlur = async () => {
    if (searchTerm !== '' && !selectedCi) {
      setCiSuggestions([]);
      setSearchTerm('');
    }
  };

  const resetSuggestions = () => {
    setSelectedCi(undefined);
    setCiSuggestions([]);
    setSearchTerm('');
  };

  useEffect(() => {
    const initializeInputs = async () => {
      if (location) {
        const newCiSuggestions = await searchCi(location.name);
        setCiSuggestions(newCiSuggestions);

        const newSelectedCi = newCiSuggestions.find((ciOption) => ciOption.name === location.name);
        setSelectedCi(newSelectedCi);
      }
    };

    initializeInputs();
  }, [location]);

  return (
    <div className="location-line">
      <div className="ci-input">
        <ComboBox
          id={`${pathStepId}-ci`}
          data-testid="operational-point-ci"
          label={t('trainPath.ci')}
          value={selectedCi}
          suggestions={ciSuggestions}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchTerm(e.target.value);
          }}
          getSuggestionLabel={(option: CIOption) => option.label}
          onSelectSuggestion={handleCiSelect}
          onBlur={onBlur}
          resetSuggestions={resetSuggestions}
          disabled={disabled}
          autoComplete="off"
          narrow
        />
      </div>
      <div className="ch-input">
        <Select
          label={t('trainPath.ch')}
          id={`${pathStepId}-ch`}
          data-testid="operational-point-ch"
          value={selectedCh}
          onChange={handleChSelect}
          options={selectedCi?.chOptions || []}
          getOptionLabel={(option: { id: string; label: string }) => option.label}
          getOptionValue={(option: { id: string; label: string }) => option.id}
          disabled={disabled}
          narrow
        />
      </div>
    </div>
  );
};

export default StdcmOperationalPoint;
