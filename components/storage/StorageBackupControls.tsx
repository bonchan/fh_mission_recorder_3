import React, { useRef } from 'react';
import { createLogger } from '@/utils/logger';
import { useToast } from '@/providers/ToastProvider';
import Button from '@/components/ui/Button';

// Import your Dexie database instance
import { db } from '@/utils/db'; 

const log = createLogger('StorageBackupControls');

export function StorageBackupControls() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // --- 1. BACKUP LOGIC (IndexedDB) ---
  const handleBackup = async () => {
    try {
      const allDbData: Record<string, any[]> = {};

      // Dynamically loop through every table defined in your Dexie schema
      for (const table of db.tables) {
        allDbData[table.name] = await table.toArray();
      }

      const blob = new Blob([JSON.stringify(allDbData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `flighthub-idb-backup-${dateStr}.json`;
      a.click();

      window.URL.revokeObjectURL(url);
      log.info('IndexedDB backup generated successfully.');
    } catch (err) {
      log.error("Failed to backup IndexedDB:", err);
      showToast("Failed to backup database:", String(err), 'error');
    }
  };

  // --- 2. RESTORE LOGIC (IndexedDB) ---
  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        
        // Get the names of the tables in the backup file
        const backupTableNames = Object.keys(parsedData);
        
        // Filter to only include tables that actually exist in your current schema
        const validTables = db.tables.filter(table => backupTableNames.includes(table.name));

        if (validTables.length === 0) {
           throw new Error("No matching tables found in this backup file.");
        }

        // Run the wipe and insert inside a single Transaction.
        // If anything fails here, Dexie automatically rolls back to the previous state!
        await db.transaction('rw', validTables, async () => {
          for (const table of validTables) {
            log.info(`Restoring table: ${table.name}...`);
            
            // 1. Wipe current table clean
            await table.clear();
            
            // 2. Bulk insert the backup records
            const recordsToInsert = parsedData[table.name];
            if (recordsToInsert && recordsToInsert.length > 0) {
              await table.bulkAdd(recordsToInsert);
            }
          }
        });

        showToast("Database restored successfully!", '', 'success');

        // Reload to let Dexie's useLiveQuery hooks re-mount and pull the fresh data
        window.location.reload();

      } catch (err) {
        log.error("Failed to parse or restore IDB backup", err);
        showToast("Invalid backup file.", 'Make sure it is an IndexedDB backup.', 'error', 4000);
      } finally {
        event.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  // --- 3. RENDER BUTTONS ---
  return (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
      <Button onClick={handleBackup} variant='success'>Backup Database</Button>
      <Button onClick={() => fileInputRef.current?.click()}>Restore Database</Button>

      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleRestore}
        style={{ display: 'none' }}
      />
    </div>
  );
}