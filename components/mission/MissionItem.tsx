import React, { useState } from 'react';
import { Mission } from '@/utils/interfaces';

interface MissionItemProps {
  mission: Mission;
  onUpdate: (updatedMission: Mission) => void;
}

export function MissionItem({ mission, onUpdate }: MissionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(mission.name);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditName(mission.name); // Reset the input to the current name
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName(mission.name);
  };

  const handleConfirm = () => {
    const trimmedName = editName.trim();
    
    // Only update if the name actually changed and isn't empty
    if (trimmedName && trimmedName !== mission.name) {
      onUpdate({ 
        ...mission, 
        name: trimmedName, 
        updatedDate: Date.now() 
      });
    }
    setIsEditing(false);
  };

  // Bonus: Let the user hit Enter to save or Escape to cancel
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div style={{ border: '1px solid #333', padding: '12px', marginBottom: '8px', borderRadius: '4px', background: '#1e1e1e' }}>
      
      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <input 
            autoFocus // Automatically puts the cursor in the box
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              background: '#2c2c2c', border: '1px solid #0066ff', color: 'white', 
              padding: '4px 8px', borderRadius: '4px', outline: 'none', flexGrow: 1,
              fontSize: '1rem', fontWeight: 'bold'
            }}
          />
          <button onClick={handleConfirm} style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>✓</button>
          <button onClick={handleCancel} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>✕</button>
        </div>
      ) : (
        <h4 
          onDoubleClick={handleDoubleClick} 
          style={{ marginTop: 0, marginBottom: '4px', cursor: 'text' }}
          title="Double click to edit"
        >
          {mission.name}
        </h4>
      )}

      <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
        Dock: {mission.device?.parent?.deviceSn}
      </p>
    </div>
  );
}