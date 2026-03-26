import React, { useState, ChangeEvent, KeyboardEvent } from 'react';

interface SearchInputProps {
  /** Callback fired when the input value changes */
  onSearch?: (value: string) => void;
  /** Custom placeholder text */
  placeholder?: string;
  /** Custom width for the container */
  width?: string | number;
  /** Optional initial value */
  initialValue?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ 
  onSearch, 
  placeholder = "Search...", 
  width = '300px',
  initialValue = ''
}) => {
  const [query, setQuery] = useState<string>(initialValue);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSearch?.(val);
  };

  const handleClear = () => {
    setQuery('');
    onSearch?.('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  // Shared icon styles
  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    transition: 'all 0.2s ease',
  };

  return (
    <div style={{ position: 'relative', width }}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 32px 8px 12px',
          borderRadius: '6px',
          border: '1px solid #444',
          backgroundColor: '#1a1a1a',
          color: '#eee',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s'
        }}
        // Inline focus ring simulation
        onFocus={(e) => (e.currentTarget.style.borderColor = '#666')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#444')}
      />

      {query ? (
        <svg
          onClick={handleClear}
          style={{ ...iconStyle, cursor: 'pointer', color: '#999' }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      ) : (
        <svg
          style={{ ...iconStyle, pointerEvents: 'none', color: '#666' }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      )}
    </div>
  );
};

export default SearchInput;