import React, { useState } from 'react';

export function CockpitOverlay({ }: {}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overrideAction, setOverrideAction] = useState('');

  const handle = (value: string) => {
    setOverrideAction(value)

  };

  return (
    <div
      style={{
        width: '100%',
        background: '#1e1e1e',
        borderRadius: '8px',
        transition: 'border-color 0.2s ease',
        border: `1px solid ${isExpanded ? '#dd9611' : '#333'}`,
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {/* HEADER SECTION */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '12px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ flexGrow: 1, marginRight: '16px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px', color: '#dd9611' }}>
            Cockpit Overlay
          </div>

        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '18px', color: '#555', userSelect: 'none' }}>
            {isExpanded ? '▾' : '▸'}
          </div>
        </div>
      </div>

      {/* EXPANDED SECTION */}
      {isExpanded && (
        <div style={{ padding: '12px', borderTop: '1px solid #333', background: '#181818', borderRadius: '0 0 8px 8px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '6px', fontWeight: 'bold' }}>
              MANUAL OVERRIDE
            </label>
            <select
              value={overrideAction}
              onChange={(e) => handle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#2c2c2c',
                color: 'white',
                border: '1px solid #444',
                borderRadius: '4px',
                outline: 'none',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="">No Overlay</option>
              <option value="execute">▶ Execute Plan</option>
              <option value="pause">⏸ Pause Flight</option>
              <option value="rth">🏠 Return to Home</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '40vh', overflowY: 'auto', paddingRight: '4px' }}>
          </div>
        </div>
      )}
    </div>
  );
}