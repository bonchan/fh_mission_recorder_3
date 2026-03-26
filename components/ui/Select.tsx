import React, { ChangeEvent } from 'react';

// Use a generic T to make this reusable for any Enum or String union
interface SelectProps<T extends string | number> {
  label?: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  width?: string | number;
}

const Select = <T extends string | number>({
  label,
  value,
  options,
  onChange,
  width = '100%',
}: SelectProps<T>) => {

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as T);
  };

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: '4px',
          border: '1px solid #444',
          backgroundColor: '#222',
          color: '#fff',
          fontSize: '13px',
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none', // Removes default browser arrow for custom look
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;