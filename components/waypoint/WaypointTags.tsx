import React, { useMemo, useState } from 'react';
import { TagCategory, TagOption, TAG_OPTIONS } from '@/utils/interfaces';

interface WaypointTagsProps {
  selectedTagIds: string[];
  onChange: (newTagIds: string[]) => void;
}

// 1. Define the strict sorting order for the top row
const CATEGORY_ORDER: TagCategory[] = ['flight_route', 'location', 'asset', 'intention'];

const CATEGORY_LABELS: Record<TagCategory, string> = {
  flight_route: 'Flight Route',
  location: 'Location',
  asset: 'Asset',
  intention: 'Intention'
};

const CATEGORY_COLORS: Record<TagCategory, string> = {
  flight_route: '#be185d',
  location: '#7e22ce',
  asset: '#312e81',
  intention: '#c2410c'
};

export function WaypointTags({ selectedTagIds = [], onChange }: WaypointTagsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  // 1. Get the full tag objects for the selected IDs and sort them by category
  const sortedSelectedTags = useMemo(() => {
    const tags = selectedTagIds
      .map(id => TAG_OPTIONS.find(t => t.id === id))
      .filter((t): t is TagOption => t !== undefined); // Remove undefined if an ID is orphaned

    return tags.sort((a, b) => {
      return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    });
  }, [selectedTagIds]);

  // 2. Group ALL available tags by category for the multi-selectors
  const tagsByCategory = useMemo(() => {
    const grouped = {} as Record<TagCategory, TagOption[]>;
    
    // Initialize empty arrays to maintain order
    CATEGORY_ORDER.forEach(cat => grouped[cat] = []);
    
    TAG_OPTIONS.forEach(tag => {
      if (grouped[tag.category]) {
        grouped[tag.category].push(tag);
      }
    });
    return grouped;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* SECTION 1: The General Summary Row */}
      <div style={{ padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #333' }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>
          Selected Tags
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {sortedSelectedTags.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#555' }}>No tags selected.</span>
          ) : (
            sortedSelectedTags.map(tag => {
              const tagColor = CATEGORY_COLORS[tag.category] || '#0066ff';
              return (
              <span 
                key={`selected-${tag.id}`} 
                style={{ 
                  padding: '2px 8px', 
                  backgroundColor: tagColor, 
                  color: 'white', 
                  borderRadius: '12px', 
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}
              >
                {tag.name}
              </span>
            )})
          )}
        </div>
      </div>

      <div 
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#888',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '2px 0'
        }}
      >
        <span style={{ 
          display: 'inline-block', 
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
          transition: 'transform 0.2s ease' 
        }}>
          ▼
        </span>
        {isExpanded ? 'HIDE TAG SELECTORS' : 'EDIT TAGS'}
      </div>

      {/* SECTION 2: Multi-Selectors by Category (HIDDEN BY DEFAULT) */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px' }}>
          {CATEGORY_ORDER.map(category => {
            const options = tagsByCategory[category];
            if (!options || options.length === 0) return null;

            return (
              <div key={category}>
                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '6px', fontWeight: 'bold' }}>
                  {CATEGORY_LABELS[category]}
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {options.map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    const rowColor = CATEGORY_COLORS[category] || '#0066ff';
                    return (
                      <button
                        key={`option-${tag.id}`}
                        onClick={(e) => {
                          e.stopPropagation(); 
                          handleToggleTag(tag.id);
                        }}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: isSelected ? rowColor : '#252525',
                          color: 'white',
                          border: `1px solid ${rowColor}`,
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}