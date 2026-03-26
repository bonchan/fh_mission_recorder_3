import React, { useRef } from 'react';
import { createLogger } from '@/utils/logger';
import { useToast } from '@/providers/ToastProvider';


const log = createLogger('StorageBackupControls');

export function StorageBackupControls() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // --- 1. BACKUP LOGIC ---
  const handleBackup = async () => {
    try {
      // Passing `null` to .get() fetches the ENTIRE storage object!
      const allStorageData = await browser.storage.local.get(null);

      const blob = new Blob([JSON.stringify(allStorageData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `extension-backup-${dateStr}.json`;
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      log.error("Failed to backup extension storage:", err);
      showToast("Failed to backup extension storage:", String(err), 'error')
    }
  };

  // --- 2. RESTORE LOGIC ---
  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    // Using reader.onload as an async function so we can await the storage calls
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);

        // 1. Wipe the current extension storage clean
        await browser.storage.local.clear();

        // 2. Inject the entire JSON object back in one go!
        await browser.storage.local.set(parsedData);

        showToast("Extension storage restored successfully!", '', 'success')

        // Reload to let your extension scripts re-read the fresh storage
        window.location.reload();

      } catch (err) {
        log.error("Failed to parse or restore backup", err);
        showToast("Invalid backup file. ", 'Are you sure this is a JSON file?', 'error', 4000)

      } finally {
        event.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  // --- 3. RENDER BUTTONS ---
  return (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
      <button
        onClick={handleBackup}
        style={{ padding: '8px 16px', backgroundColor: '#10B981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        Backup
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        style={{ padding: '8px 16px', backgroundColor: '#3B82F6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        Restore
      </button>

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