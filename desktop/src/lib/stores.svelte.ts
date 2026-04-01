/** Global reactive state for the desktop sync app */

export const currentView = $state<{ value: string }>({ value: "login" });

export const syncStatus = $state<{
  status: "idle" | "syncing" | "error" | "offline" | "paused";
  progress: number;
  lastSync: number | null;
  filesSynced: number;
  pendingChanges: number;
  conflicts: number;
  error: string | null;
  storageUsed: number;
  storageQuota: number;
}>({
  status: "idle",
  progress: 0,
  lastSync: null,
  filesSynced: 0,
  pendingChanges: 0,
  conflicts: 0,
  error: null,
  storageUsed: 0,
  storageQuota: 0,
});
