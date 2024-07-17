import React, { useEffect, useRef, useState } from 'react';

import { Input, type InputProps } from '@osrd-project/ui-core';
import { isEmpty } from 'lodash';

import SelectImprovedSNCF, {
  type SelectOptionObject,
} from 'common/BootstrapSNCF/SelectImprovedSNCF';

export interface StdcmSuggestionsProps<T extends string | SelectOptionObject> extends InputProps {
  options: T[];
  onSelectSuggestion: (option: T) => void;
}

const StdcmSuggestions = <T extends string | SelectOptionObject>({
  options,
  onSelectSuggestion,
  onFocus,
  onBlur,
  disabled,
  ...rest
}: StdcmSuggestionsProps<T>) => {
  const [isSelectVisible, setIsSelectVisible] = useState(false);

  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused) {
      setIsSelectVisible(!isEmpty(options));
    }
  }, [options, isFocused]);

  return (
    <>
      <Input
        {...rest}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);

          // this will allow us to avoid the onBlur event when clicking on a suggestion
          // TODO: find a better way to do this when ui-core suggestion component is implemented
          const avoidOnBlur = containerRef.current?.contains(e.relatedTarget);
          if (!avoidOnBlur && onBlur) {
            setIsSelectVisible(false);
            onBlur(e);
          }
        }}
        autoComplete="off"
        disabled={disabled}
      />
      {isSelectVisible && (
        <div className="selector-select" ref={containerRef}>
          <SelectImprovedSNCF
            options={options}
            onChange={(option) => {
              onSelectSuggestion(option);
              setIsSelectVisible(false);
            }}
            setSelectVisibility={setIsSelectVisible}
            withSearch={false}
            disabled={disabled}
            noTogglingHeader
            isOpened
            bgWhite
            disableShadow
          />
        </div>
      )}
    </>
  );
};

export default StdcmSuggestions;
