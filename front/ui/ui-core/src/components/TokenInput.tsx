import React, { useRef, useState } from 'react';

import { X } from '@osrd-project/ui-icons';
import cx from 'classnames';

export type TokenInputProps = {
  label: string;
  tokens: string[];
  small?: boolean;
  onChange?: (tokens: string[]) => void;
  onBlur?: () => void;
  className?: string;
  dataTestId?: string;
};

const TokenInput = ({
  label,
  tokens: initialTokens,
  small,
  onChange,
  onBlur,
  className,
  dataTestId,
}: TokenInputProps) => {
  const [tokens, setTokens] = useState(initialTokens);

  // Allow to update the tokens state when an update comes from outside the component
  // See react docs: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevInitialTokens, setPrevInitialTokens] = useState(initialTokens);
  if (initialTokens !== prevInitialTokens) {
    setPrevInitialTokens(initialTokens);
    setTokens(initialTokens);
  }

  const [newToken, setNewToken] = useState('');
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addToken = (token: string) => {
    const newTokens = [...tokens, token];
    setTokens(newTokens);
    onChange?.(newTokens);
  };

  const removeToken = (index: number) => {
    const newTokens = tokens.toSpliced(index, 1);
    setTokens(newTokens);
    onChange?.(newTokens);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        // Prevent the keypress from submitting a surrounding form
        e.preventDefault();
        if (newToken.trim() !== '') {
          addToken(newToken);
          setNewToken('');
        }
        break;
      case 'Backspace':
        if (tokens.length > 0 && newToken === '') removeToken(tokens.length - 1);
        break;
      default:
        break;
    }
  };

  const focusInput = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (e.target === e.currentTarget) {
      inputRef.current?.focus();
    }
  };

  return (
    <div className={cx('ui-token-input-wrapper', { small }, className)} data-testid={dataTestId}>
      <label className="input-label">{label}</label>
      <div className="tokens-wrapper" onClick={focusInput}>
        {tokens.map((token, index) => (
          <div
            key={`${token}-${index}`}
            onClick={() => setSelectedToken(index)}
            className={cx('token-item-wrapper', { selected: selectedToken === index })}
            data-testid={dataTestId ? `${dataTestId}-token` : undefined}
          >
            <span className="token-label">{token}</span>
            <span
              className="token-close-btn"
              onClick={() => removeToken(index)}
              data-testid={dataTestId ? `${dataTestId}-token-remove` : undefined}
            >
              <X size={small ? 'sm' : 'lg'} />
            </span>
          </div>
        ))}
        <input
          type="text"
          value={newToken}
          onChange={(e) => setNewToken(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          className="token-input"
          ref={inputRef}
          data-testid={dataTestId ? `${dataTestId}-input` : undefined}
        />
      </div>
    </div>
  );
};

export default TokenInput;
