import React, { useState } from 'react';
import { MISSION_TEMPLATES, MissionTemplate } from '@/components/mission/templates'; // Adjust your import path

export function TemplateSelector({ onSelectTemplate }: { onSelectTemplate: (template: MissionTemplate | null) => void }) {
  // We store the index of the selected template (or empty string if none)
  const [selectedIndex, setSelectedIndex] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedIndex(val);

    // Pass the actual template object up to the parent component
    if (val === '') {
      onSelectTemplate(null);
    } else {
      onSelectTemplate(MISSION_TEMPLATES[Number(val)]);
    }
  };

  return (
    <div style={{ marginBottom: '15px' }}>
      <select
        value={selectedIndex}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '8px',
          background: '#2c2c2c',
          border: '1px solid #444',
          color: 'white',
          borderRadius: '4px',
          outline: 'none'
        }}
      >
        <option value="">-- Choose a Template (Optional) --</option>

        {MISSION_TEMPLATES.map((tmpl, index) => (
          <option key={tmpl.name} value={index}>
            {tmpl.name} ({tmpl.template.length} Waypoints)
          </option>
        ))}
      </select>
    </div>
  );
}