import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import { useDatabase } from '@/hooks/useDatabase';
import { useSync } from '@/hooks/useSync';
import { useToast } from '@/providers/ToastProvider';
import { createLogger } from '@/utils/logger';
import React, { useEffect, useMemo, useState } from 'react';


const log = createLogger('Annotations');

interface AnnotationsProps {
  orgId: string;
  projectId: string;
  sourceTabId: number;
  debugMode: boolean;
}

export function Annotations({ orgId, projectId, sourceTabId, debugMode }: AnnotationsProps) {
  const { projectAnnotations, saveCompromisedAnnotation, deleteCompromisedAnnotation, deleteAllCompromisedAnnotations } = useDatabase(orgId, projectId);
  const { isSyncingAnnotations, syncAnnotations } = useSync(orgId, projectId, sourceTabId)

  const compromisedAnnotations = projectAnnotations.filter(a => a.isCompromised);
  log.info('compromisedAnnotations', compromisedAnnotations)

  const [searchQuery, setSearchQuery] = useState('');

  const { showToast } = useToast()

  useEffect(() => {
    syncAnnotations();
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
    const duplicateNames = new Set<string>();
    let emptyCellCount = 0;

    const rows = pastedText.split('\n').filter(row => row.trim() !== '');

    rows.forEach(row => {
      const cells = row.split('\t');

      cells.forEach((cellText) => {
        const trimmedName = cellText.trim();

        if (!trimmedName) {
          emptyCellCount++;
          return;
        }

        const lowerName = trimmedName.toLowerCase();

        if (pastedNames.has(lowerName)) {
          duplicateNames.add(trimmedName);
          return;
        }

        pastedNames.add(lowerName);

        const match = projectAnnotations.find(
          a => a.name.toLowerCase() === lowerName
        );

        if (match) {
          saveCompromisedAnnotation({
            ...match,
            projectId: projectId,
            isCompromised: true
          });
        } else {
          saveCompromisedAnnotation({
            id: `generated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: trimmedName,
            latitude: 0,
            longitude: 0,
            color: 'black',
            projectId: projectId,
            isCompromised: true
          } as any);
        }
      });
    });

    if (duplicateNames.size > 0 || emptyCellCount > 0) {
      let msg = '';

      if (duplicateNames.size > 0) {
        msg += `\n🚨 Duplicates Skipped (${duplicateNames.size}):\n`;
      }
      if (emptyCellCount > 0) {
        msg += `\n🚨 Duplicates Skipped (${duplicateNames.size}):\n`;
        msg += Array.from(duplicateNames).map(name => ` - ${name}`).join('\n');
      }
      showToast("Paste Complete!", msg, { type: 'warning' });
    }
  };

  return (
    <div className="flight-routes-manager" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

      <section className="saved-list">
        <h2>Compromised ({compromisedAnnotations.length})</h2>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Click here and paste (Ctrl+V) from Sheets..."
            onPaste={handlePaste}
            value=""
            onChange={() => { }}
            style={{
              flex: 1,
              padding: '15px',
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
            // style={{ maxWidth: '25px', padding: '4px 4px' }}
            onClick={deleteAllCompromisedAnnotations}
            style={{
              maxWidth: '150px',
              padding: '0 20px',
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

        <div className="list-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {compromisedAnnotations.length === 0 && <p style={{ color: '#888' }}>No active annotations. Add from the right or paste above.</p>}

          {compromisedAnnotations.map(annotation => (
            <div
              key={annotation.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: '#1a1a1a',
                borderRadius: '6px',
                border: '1px solid #333'
              }}
            >
              <span style={{
                fontWeight: annotation.color === 'black' ? 'bold' : 'normal',
                color: annotation.color === 'black' ? '#dc3545' : 'inherit'
              }}>
                {annotation.name} {annotation.color === 'black' && "(Not Found)"}
              </span>

              <Button
                variant="sad"
                requireConfirm={true}
                confirmText="?"
                confirmVariant="danger"
                style={{ maxWidth: '25px', padding: '4px 4px' }}
                onClick={() => deleteCompromisedAnnotation(annotation.id)}
              >
                X
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="results-list">
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