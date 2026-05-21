import React, { useRef, useState } from 'react';

import { X } from '@osrd-project/ui-icons';
import cx from 'classnames';

export type TokenInputProps = {
  label: string;
  tokens: string[];
  small?: boolean;
};

const TokenInput = ({ label, tokens: initialTokens, small }: TokenInputProps) => {
  const [tokens, setTokens] = useState(initialTokens);
  const [newToken, setNewToken] = useState('');
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addToken = (token: string) => {
    setTokens((oldTokens) => [...oldTokens, token]);
  };

  const removeToken = (index: number) => {
    setTokens((oldTokens) => oldTokens.toSpliced(index, 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
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
    <div className={cx('ui-token-input-wrapper', { small })}>
      <label className="input-label">{label}</label>
      <div className="tokens-wrapper" onClick={focusInput}>
        {tokens.map((token, index) => (
          <div
            key={`${token}-${index}`}
            onClick={() => setSelectedToken(index)}
            className={cx('token-item-wrapper', { selected: selectedToken === index })}
          >
            <span className="token-label">{token}</span>
            <span className="token-close-btn" onClick={() => removeToken(index)}>
              <X size={small ? 'sm' : 'lg'} />
            </span>
          </div>
        ))}
        <input
          type="text"
          value={newToken}
          onChange={(e) => setNewToken(e.target.value)}
          onKeyDown={handleKeyDown}
          className="token-input"
          ref={inputRef}
        />
      </div>
    </div>
  );
};

export default TokenInput;
