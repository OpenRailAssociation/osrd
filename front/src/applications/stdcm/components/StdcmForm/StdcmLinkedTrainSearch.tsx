import { useState } from 'react';

import { DatePicker, Input } from '@osrd-project/ui-core';
import { ArrowDown, ArrowUp, Gear } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import useLinkedTrainSearch from 'applications/stdcm/hooks/useLinkedTrainSearch';

import StdcmCard from './StdcmCard';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmLinkedTrainResults from './StdcmLinkedTrainResults';
import type { LinkedTrainType } from '../../types';

type StdcmLinkedTrainSearchProps = {
  disabled: boolean;
  linkedTrainType: LinkedTrainType;
  linkedOpId: string;
};

const StdcmLinkedTrainSearch = ({
  disabled,
  linkedTrainType,
  linkedOpId,
}: StdcmLinkedTrainSearchProps) => {
  const { t } = useTranslation('stdcm');
  const [displayLinkedTrainSearch, setShowLinkedTrainSearch] = useState(false);

  const {
    displaySearchButton,
    launchTrainScheduleSearch,
    linkedTrainDate,
    linkedTrainResults,
    resetLinkedTrainSearch,
    selectableSlot,
    setDisplaySearchButton,
    setLinkedTrainDate,
    setTrainNameInput,
    trainNameInput,
  } = useLinkedTrainSearch();

  const removeLinkedTrainCard = () => {
    setShowLinkedTrainSearch(false);
    resetLinkedTrainSearch();
  };

  return (
    <div className={`stdcm-linked-train-search-container ${linkedTrainType}-linked-train`}>
      {!displayLinkedTrainSearch ? (
        <StdcmDefaultCard
          disabled={disabled}
          text={t(`linkedTrainDefaultCard.${linkedTrainType}`)}
          Icon={linkedTrainType === 'anterior' ? <ArrowUp size="lg" /> : <ArrowDown size="lg" />}
          className="add-linked-train"
          onClick={() => setShowLinkedTrainSearch(true)}
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
        >
          <div className="d-flex pr-1 pl-3">
            <Input
              id="linked-train-id"
              type="text"
              value={trainNameInput}
              onChange={(e) => {
                setDisplaySearchButton(true);
                setTrainNameInput(e.target.value);
              }}
              label="N°"
            />
            <DatePicker
              inputProps={{
                id: 'linked-train-date',
                label: 'Date',
                name: 'op-date',
              }}
              selectableSlot={selectableSlot}
              value={linkedTrainDate}
              onDateChange={(date) => {
                setDisplaySearchButton(true);
                setLinkedTrainDate(date);
              }}
            />
          </div>
          {displaySearchButton && (
            <button
              data-testid="linked-train-search-button"
              className="stdcm-linked-train-button"
              type="button"
              onClick={launchTrainScheduleSearch}
            >
              {t('find')}
            </button>
          )}
          {!displaySearchButton && !linkedTrainResults && (
            <div className="stdcm-linked-train-button white">
              <Gear size="lg" className="stdcm-linked-train-loading" />
            </div>
          )}
          {linkedTrainResults &&
            (linkedTrainResults.length > 0 ? (
              <StdcmLinkedTrainResults
                linkedTrainResults={linkedTrainResults}
                linkedOp={{
                  extremityType: linkedTrainType === 'anterior' ? 'destination' : 'origin',
                  id: linkedOpId,
                }}
              />
            ) : (
              <p className="text-center mb-0">{t('noCorrespondingResults')}</p>
            ))}
        </StdcmCard>
      )}
    </div>
  );
};

export default StdcmLinkedTrainSearch;
