import React from 'react';

interface CompassProps {
  rotation: number;
  onClick: () => void;
}

export const Compass: React.FC<CompassProps> = ({ rotation, onClick }) => {
  return (
    <div
      onClick={onClick}
      title="Reset to North-Up / Zenithal"
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: 'rgba(20, 20, 20, 0.85)',
        border: '2px solid #333',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#888',
        fontSize: '11px',
        fontWeight: 'bold',
        userSelect: 'none',
        boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
        transform: `rotate(${-rotation}deg)`,
        transition: 'transform 0.1s linear, border-color 0.2s, color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#0066ff';
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#333';
        e.currentTarget.style.color = '#888';
      }}
    >
      <span style={{ position: 'absolute', top: 4, color: '#ff4444' }}>N</span>
      <span style={{ position: 'absolute', bottom: 4 }}>S</span>
      <span style={{ position: 'absolute', right: 6 }}>E</span>
      <span style={{ position: 'absolute', left: 6 }}>W</span>
      {/* Center Pivot Point */}
      <div 
        style={{ 
          width: '8px', 
          height: '8px', 
          backgroundColor: '#555', 
          borderRadius: '50%',
          border: '1px solid #000' 
        }} 
      />
    </div>
  );
};