import { useState } from 'react';

import { DatePicker, Input } from '@osrd-project/ui-core';
import { ArrowDown, ArrowUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import useLinkedTrainSearch from 'applications/stdcm/hooks/useLinkedTrainSearch';

import type { LinkedTrainType } from '../../types';
import StdcmCard from './StdcmCard';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmLinkedTrainResults from './StdcmLinkedTrainResults';

type StdcmLinkedTrainSearchProps = {
  disabled: boolean;
  linkedTrainType: LinkedTrainType;
};

const StdcmLinkedTrainSearch = ({ disabled, linkedTrainType }: StdcmLinkedTrainSearchProps) => {
  const { t } = useTranslation('stdcm');
  const [displayLinkedTrainSearch, setShowLinkedTrainSearch] = useState(false);
  const [isLinkedTrainDateValid, setIsLinkedTrainDateValid] = useState(true);

  const {
    loading,
    searchTerm,
    setSearchTerm,
    selectableDateSlot,
    searchDate,
    setSearchDate,
    searchedLinkedTrains,
    launchSearch,
    selectedLinkedTrainIndex,
    selectLinkedTrain,
    resetSearch,
  } = useLinkedTrainSearch(linkedTrainType);

  const removeLinkedTrainCard = () => {
    setShowLinkedTrainSearch(false);
    resetSearch();
  };

  return (
    <div
      data-testid={`${linkedTrainType}-container`}
      className={`stdcm-linked-train-search-container ${linkedTrainType === 'anteriorTrain' ? 'anterior' : 'posterior'}-linked-train`}
    >
      {!(displayLinkedTrainSearch || searchedLinkedTrains) ? (
        <StdcmDefaultCard
          disabled={disabled}
          text={t(`linkedTrainDefaultCard.${linkedTrainType}`)}
          Icon={
            linkedTrainType === 'anteriorTrain' ? <ArrowUp size="lg" /> : <ArrowDown size="lg" />
          }
          className="add-linked-train"
          onClick={() => setShowLinkedTrainSearch(true)}
          testId="add-linked-train"
        />
      ) : (
        <StdcmCard
          disabled={disabled}
          name={t(`trainPath.linkedTrain.${linkedTrainType}`)}
          title={
            <button
              data-testid="linked-train-delete-button"
              type="button"
              onClick={removeLinkedTrainCard}
            >
              {t('translation:common.delete').toLowerCase()}
            </button>
          }
          className="linked-train"
          testId="linked-train"
        >
          <div className="linked-train-inputs">
            <Input
              testIdPrefix="linked-train-id"
              id="linked-train-id"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              label="N°"
              narrow
            />
            <DatePicker
              testIdPrefix="linked-train-date"
              inputProps={{
                id: 'linked-train-date',
                label: 'Date',
                name: 'op-date',
                narrow: true,
              }}
              selectableSlot={selectableDateSlot}
              value={searchDate}
              onDateChange={(date) => {
                setIsLinkedTrainDateValid(date !== undefined);
                if (date) {
                  setSearchDate(date);
                }
              }}
            />
          </div>
          {!loading && searchTerm && searchDate && (
            <button
              data-testid="linked-train-search-button"
              className="stdcm-linked-train-button"
              type="button"
              onClick={launchSearch}
              disabled={!isLinkedTrainDateValid}
            >
              {t('find')}
            </button>
          )}
          {(searchedLinkedTrains || loading) && (
            <StdcmLinkedTrainResults
              linkedTrainType={linkedTrainType}
              linkedTrainResults={searchedLinkedTrains}
              selectLinkedTrain={selectLinkedTrain}
              selectedLinkedTrainIndex={selectedLinkedTrainIndex}
              loading={loading}
            />
          )}
        </StdcmCard>
      )}
    </div>
  );
};

export default StdcmLinkedTrainSearch;
