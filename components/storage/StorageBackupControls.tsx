import React, { useRef } from 'react';
import { createLogger } from '@/utils/logger';
import { useToast } from '@/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { useDatabase } from '@/hooks/useDatabase';

const log = createLogger('StorageBackupControls');

interface StorageBackupControlsProps {
  orgId: string;
  projectId: string;
}

export function StorageBackupControls({ orgId, projectId }: StorageBackupControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const { doBackup, doRestore } = useDatabase(orgId, projectId)

  // --- 1. BACKUP LOGIC (IndexedDB) ---
  const handleBackup = async () => {
    try {
      // 1. Ask the DB for the backup file
      const backupBlob = await doBackup();

      // 2. UI Logic: Create the download link and click it
      const url = window.URL.createObjectURL(backupBlob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `flighthub-idb-backup-${dateStr}.json`;

      document.body.appendChild(a); // Safest way to trigger clicks in some browsers
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // 3. Optional: Show a success toast!
      showToast("Backup downloaded successfully!", '', { type: "success" })

    } catch (err) {
      log.error("Failed to backup IndexedDB:", err);
      showToast("Failed to backup database:", String(err), { type: "error" })
    }
  };

  // --- 2. RESTORE LOGIC (IndexedDB) ---
  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // 1. Tell the DB to do the work
      await doRestore(file);

      // 2. UI Logic: Success!
      showToast("Database restored successfully! Reloading...", '', { type: "success" })

      // 3. UI Logic: Delay the reload so they see the toast
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      // 4. UI Logic: Failure!
      showToast("Invalid backup file.", 'Make sure it is an IndexedDB backup.', { type: "error", permanent: true })
    } finally {
      // 5. Always clear the input so they can try again with the same file if needed
      event.target.value = '';
    }
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