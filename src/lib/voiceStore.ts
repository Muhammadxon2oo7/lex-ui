/**
 * The student's spoken answers, kept in THIS browser only (IndexedDB), for the practice record:
 * listen back, download the whole hearing as audio. Nothing here leaves the device unless the
 * student downloads it. Every call is best-effort: private mode or blocked storage just means
 * the record has text without the student's voice.
 */
const DB = 'lexsim-record';
const STORE = 'voice';

export interface VoiceClip {
  /** Session or case-room id the answer belongs to. */
  scope: string;
  /** The answer as sent (matches the transcript line). */
  text: string;
  wav: ArrayBuffer;
  at: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { autoIncrement: true });
      s.createIndex('scope', 'scope');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVoice(scope: string, text: string, wav: ArrayBuffer): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ scope, text: text.trim(), wav, at: Date.now() } satisfies VoiceClip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* no storage: the record keeps the text only */
  }
}

export async function voicesOf(scope: string): Promise<VoiceClip[]> {
  try {
    const db = await open();
    const all = await new Promise<VoiceClip[]>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).index('scope').getAll(scope);
      req.onsuccess = () => resolve(req.result as VoiceClip[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}

export async function clearVoices(scope: string): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).index('scope').openCursor(scope);
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          c.delete();
          c.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* nothing to clear */
  }
}
