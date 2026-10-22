import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import { useDatabase } from '@/hooks/useDatabase';
import { useSync } from '@/hooks/useSync';
import { useToast } from '@/providers/ToastProvider';
import { createLogger } from '@/utils/logger';
import React, { useEffect, useMemo, useState } from 'react';


const log = createLogger('Annotations');

const LIST_HEIGHT = '600px';

interface AnnotationsProps {
  orgId: string;
  projectId: string;
  sourceTabId: number;
  debugMode: boolean;
}

interface PastedName {
  name: string;
  count: number;
}

interface ListPanelProps {
  title: string;
  count: number;
  color?: string;
  emptyText: string;
  onClear?: () => void;
  children: React.ReactNode;
}

function ListPanel({ title, count, color, emptyText, onClear, children }: ListPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, border: '1px solid #333', borderRadius: '6px', background: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid #333' }}>
        <strong style={{ fontSize: '13px', color: color ?? 'inherit' }}>{title} ({count})</strong>
        {onClear && count > 0 && (
          <button
            onClick={onClear}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '12px', padding: 0 }}
          >
            clear
          </button>
        )}
      </div>
      <div style={{ height: LIST_HEIGHT, overflowY: 'auto', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {count === 0 ? <p style={{ color: '#888', fontSize: '12px', margin: '4px' }}>{emptyText}</p> : children}
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '6px',
  padding: '3px 6px',
  background: '#1a1a1a',
  borderRadius: '4px',
  fontSize: '13px',
};

const nameStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export function Annotations({ orgId, projectId, sourceTabId, debugMode }: AnnotationsProps) {
  const { projectAnnotations, saveCompromisedAnnotation, deleteCompromisedAnnotation, deleteAllCompromisedAnnotations } = useDatabase(orgId, projectId);
  const { isSyncingAnnotations, syncAnnotations } = useSync(orgId, projectId, sourceTabId)

  const compromisedAnnotations = projectAnnotations.filter(a => a.isCompromised);

  const [searchQuery, setSearchQuery] = useState('');

  // Result of the last paste. Page-only, not persisted.
  const [duplicates, setDuplicates] = useState<PastedName[]>([]);
  const [notFound, setNotFound] = useState<PastedName[]>([]);

  const { showToast } = useToast()

  useEffect(() => {
    syncAnnotations();
    setDuplicates([]);
    setNotFound([]);
  }, [projectId]);

  const searchResults = useMemo(() => {

    const validAnnotations = projectAnnotations.filter(annotation => annotation.name);

    if (!searchQuery.trim()) {
      return validAnnotations.slice(0, 10);
    }

    const lowerQuery = searchQuery.toLowerCase();
    return validAnnotations.filter(annotation =>
      annotation.name.toLowerCase().includes(lowerQuery)
    ).slice(0, 50);
  }, [searchQuery, projectAnnotations]);

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    for (const annotation of compromisedAnnotations) {
      deleteCompromisedAnnotation(annotation.id);
    }

    const pastedNames = new Set<string>();
    // Keyed by lowercase name; count = how many times it appeared in total.
    const duplicateMap = new Map<string, PastedName>();
    const notFoundMap = new Map<string, PastedName>();
    let savedCount = 0;
    let total = 0;          // every non-empty cell pasted
    let skippedDupes = 0;   // extra occurrences beyond the first

    const rows = pastedText.split(/\r?\n/).filter(row => row.trim() !== '');

    rows.forEach(row => {
      row.split('\t').forEach((cellText) => {
        const trimmedName = cellText.trim();
        if (!trimmedName) return;

        total++;
        const lowerName = trimmedName.toLowerCase();

        if (pastedNames.has(lowerName)) {
          skippedDupes++;
          const existing = duplicateMap.get(lowerName);
          if (existing) existing.count++;
          else duplicateMap.set(lowerName, { name: trimmedName, count: 2 });
          return;
        }

        pastedNames.add(lowerName);

        const match = projectAnnotations.find(
          a => a.name?.toLowerCase() === lowerName
        );

        if (match) {
          savedCount++;
          saveCompromisedAnnotation({
            ...match,
            projectId: projectId,
            isCompromised: true
          });
        } else {
          notFoundMap.set(lowerName, { name: trimmedName, count: 1 });
        }
      });
    });

    const dupList = Array.from(duplicateMap.values());
    const notFoundList = Array.from(notFoundMap.values());
    setDuplicates(dupList);
    setNotFound(notFoundList);

    // saved + skipped duplicates + not found === total
    const msg = `Saved: ${savedCount} · Duplicates skipped: ${skippedDupes} · Not found: ${notFoundList.length}`;
    const hasIssues = dupList.length > 0 || notFoundList.length > 0;
    showToast(`Paste Complete! Total: ${total}`, msg, { type: hasIssues ? 'warning' : 'success' });

    if (hasIssues) log.warn('paste issues', { duplicates: dupList, notFound: notFoundList });
  };

  return (
    <div className="flight-routes-manager" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>

      <section className="saved-list" style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <input
            id="annotations-input"
            type="text"
            placeholder="Click here and paste (Ctrl+V) from Sheets..."
            onPaste={handlePaste}
            value=""
            onChange={() => { }}
            style={{
              flex: 1,
              padding: '10px',
              border: '2px dashed #007bff',
              borderRadius: '4px',
              textAlign: 'center',
              outline: 'none',
              background: 'transparent',
            }}
          />
          <Button
            variant="sad"
            requireConfirm={true}
            confirmText="sure?"
            confirmVariant="danger"
            onClick={deleteAllCompromisedAnnotations}
            style={{
              maxWidth: '150px',
              padding: '0 20px',
              marginBottom: '0px',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            Delete all
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
          <ListPanel
            title="Compromised"
            count={compromisedAnnotations.length}
            emptyText="None saved. Paste above or mark from the right."
          >
            {compromisedAnnotations.map(annotation => (
              <div key={annotation.id} style={rowStyle}>
                <span style={nameStyle} title={annotation.name}>{annotation.name}</span>
                <Button
                  variant="sad"
                  requireConfirm={true}
                  confirmText="?"
                  confirmVariant="danger"
                  style={{ maxWidth: '22px', padding: '0 4px', marginBottom: 0, flexShrink: 0 }}
                  onClick={() => deleteCompromisedAnnotation(annotation.id)}
                >
                  X
                </Button>
              </div>
            ))}
          </ListPanel>

          <ListPanel
            title="Duplicates"
            count={duplicates.length}
            color="#ffc107"
            emptyText="No duplicates in last paste."
            onClear={() => setDuplicates([])}
          >
            {duplicates.map(d => (
              <div key={`dup-${d.name}`} style={rowStyle}>
                <span style={nameStyle} title={d.name}>{d.name}</span>
                <span style={{ color: '#888', fontSize: '12px', flexShrink: 0 }}>×{d.count}</span>
              </div>
            ))}
          </ListPanel>

          <ListPanel
            title="Not found"
            count={notFound.length}
            color="#dc3545"
            emptyText="Everything in last paste was found."
            onClear={() => setNotFound([])}
          >
            {notFound.map(n => (
              <div key={`nf-${n.name}`} style={rowStyle}>
                <span style={nameStyle} title={n.name}>{n.name}</span>
              </div>
            ))}
          </ListPanel>
        </div>
      </section>

      <section className="results-list" style={{ minWidth: 0 }}>
        <div style={{ marginBottom: '16px' }}>
          <SearchInput
            onSearch={setSearchQuery}
            initialValue={searchQuery}
            placeholder="Search master list..."
          />
        </div>

        <div className="list-container" style={{ maxWidth: '350px', paddingLeft: '10px' }}>
          {isSyncingAnnotations && <p>Loading master list...</p>}
          {!isSyncingAnnotations && searchResults.length === 0 && <p>No annotations found.</p>}
          {!isSyncingAnnotations && <span
            style={{ fontSize: '12px', color: '#888', marginBottom: '10px', display: 'block' }}
          >Showing {searchResults.length} of {projectAnnotations.length}</span>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {searchResults.map(annotation => {
              const isAlreadyAdded = compromisedAnnotations.some(a => a.id === annotation.id);

              return (
                <div key={`search-${annotation.id}`} className="route-item card result" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #333', background: '#111' }}>
                  <span>{annotation.name}</span>
                  <button
                    onClick={() => saveCompromisedAnnotation({ id: annotation.id, projectId: projectId, isCompromised: true })}
                    disabled={isAlreadyAdded}
                    style={{
                      cursor: isAlreadyAdded ? 'not-allowed' : 'pointer',
                      background: isAlreadyAdded ? '#333' : '#007bff',
                      color: isAlreadyAdded ? '#888' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px'
                    }}
                  >
                    {isAlreadyAdded ? 'Added' : 'Mark'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}
