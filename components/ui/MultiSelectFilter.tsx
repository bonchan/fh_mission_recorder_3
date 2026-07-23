import React from 'react';

// Define the shape of our options
export interface FilterOption<T> {
  label: string;
  value: T;
}

interface MultiSelectFilterProps<T> {
  label?: string;
  /** The list of available options to display */
  options: FilterOption<T>[];
  /** The currently selected values (managed by parent) */
  selectedValues: T[];
  /** Callback fired when a pill is clicked */
  onChange: (values: T[]) => void;
  width?: string | number;
}

// Using a standard function declaration here because arrow functions 
// with generics in TSX can cause syntax conflicts.
export function MultiSelectFilter<T extends string | number>({
  label,
  options,
  selectedValues,
  onChange,
  width = '100%'
}: MultiSelectFilterProps<T>) {

  const toggleOption = (val: T) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val)); // Remove
    } else {
      onChange([...selectedValues, val]); // Add
    }
  };

  return (
    <div>
      {label && (
        <label style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width, marginBottom: '15px', marginTop: '2px' }}>
        {options.map((opt) => {
          const isActive = selectedValues.includes(opt.value);
          return (
            <button
              key={String(opt.value)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleOption(opt.value);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: isActive ? '1px solid #888' : '1px solid #444',
                backgroundColor: isActive ? '#333' : '#1a1a1a',
                color: isActive ? '#fff' : '#888',
                fontSize: '11px',
                fontWeight: isActive ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MultiSelectFilter;