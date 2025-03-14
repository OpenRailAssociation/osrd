import React, { useRef, useState } from 'react';

import { X } from '@osrd-project/ui-icons';
import cx from 'classnames';

export type TokenInputProps = {
  label: string;
  tokens: string[];
};

const TokenInput = ({ label, tokens: initialTokens }: TokenInputProps) => {
  const [tokens, setTokens] = useState(initialTokens);
  const [newToken, setNewToken] = useState('');
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addToken = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newToken.trim() !== '') {
      setTokens((oldTokens) => [...oldTokens, newToken]);
      setNewToken('');
    }
  };

  const focusInput = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (e.target === e.currentTarget) {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="token-input-wrapper">
      <label className="input-label">{label}</label>
      <div className="tokens-wrapper" onClick={focusInput}>
        {tokens.map((token, index) => (
          <div
            key={`${token}-${index}`}
            onClick={() => setSelectedToken(index)}
            className={cx('token-item-wrapper', { selected: selectedToken === index })}
          >
            <span className="token-label">{token}</span>
            <span
              className="token-close-btn"
              onClick={() => setTokens((oldTokens) => oldTokens.filter((_t, i) => i !== index))}
            >
              <X />
            </span>
          </div>
        ))}
        <input
          type="text"
          value={newToken}
          onChange={(e) => setNewToken(e.target.value)}
          onKeyDown={addToken}
          className="token-input"
          ref={inputRef}
        />
      </div>
    </div>
  );
};

export default TokenInput;
