import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  initProjectStore,
  saveProject,
  getProject,
  getAllProjects,
  deleteProject,
  isStorageAvailable
} from '../src/storage/projectStore.js';

describe('projectStore.js (IndexedDB & Fallback Store)', () => {
  beforeEach(async () => {
    await initProjectStore();
  });

  it('initializes native storage successfully when indexedDB is available', async () => {
    const status = await initProjectStore();
    expect(status.success).toBe(true);
    expect(isStorageAvailable()).toBe(true);
  });

  it('saves and retrieves a project', async () => {
    const project = {
      id: 'proj_test_1',
      name: 'Cyberpunk Edit',
      updatedAt: 1000,
      clips: [{ id: 'c1', duration: 10 }],
      filter: 'vhs-cyber'
    };

    const saveResult = await saveProject(project);
    expect(saveResult.success).toBe(true);

    const loaded = await getProject('proj_test_1');
    expect(loaded).toBeDefined();
    expect(loaded.name).toBe('Cyberpunk Edit');
    expect(loaded.clips).toHaveLength(1);
    expect(loaded.filter).toBe('vhs-cyber');
  });

  it('rejects saving a project without a valid id', async () => {
    const invalidProject = { name: 'No ID' };
    const res = await saveProject(invalidProject);
    expect(res.success).toBe(false);
    expect(res.error).toContain('valid ID');
  });

  it('returns null when fetching non-existent project id or empty id', async () => {
    expect(await getProject(null)).toBeNull();
    expect(await getProject('non_existent')).toBeNull();
  });

  it('lists all saved projects sorted by updatedAt descending', async () => {
    const projA = { id: 'p_a', name: 'Older', updatedAt: 100 };
    const projB = { id: 'p_b', name: 'Newer', updatedAt: 500 };
    const projC = { id: 'p_c', name: 'Middle', updatedAt: 300 };

    await saveProject(projA);
    await saveProject(projB);
    await saveProject(projC);

    const all = await getAllProjects();
    expect(all.length).toBeGreaterThanOrEqual(3);

    // Verify ordering
    const ids = all.map((p) => p.id);
    const bIndex = ids.indexOf('p_b');
    const cIndex = ids.indexOf('p_c');
    const aIndex = ids.indexOf('p_a');

    expect(bIndex).toBeLessThan(cIndex);
    expect(cIndex).toBeLessThan(aIndex);
  });

  it('deletes a project successfully', async () => {
    const toDelete = { id: 'del_me', name: 'To Delete', updatedAt: 200 };
    await saveProject(toDelete);

    const before = await getProject('del_me');
    expect(before).not.toBeNull();

    const delRes = await deleteProject('del_me');
    expect(delRes.success).toBe(true);

    const after = await getProject('del_me');
    expect(after).toBeNull();
  });

  it('falls back seamlessly to in-memory store when IndexedDB is unavailable', async () => {
    const origIndexedDB = globalThis.indexedDB;
    try {
      // Simulate environment where indexedDB is completely blocked or null
      globalThis.indexedDB = null;
      const status = await initProjectStore();
      expect(status.inMemory).toBe(true);
      expect(isStorageAvailable()).toBe(false);

      const fallbackProject = { id: 'mem_p1', name: 'In-Memory Project', updatedAt: 1234 };
      const saveRes = await saveProject(fallbackProject);
      expect(saveRes.success).toBe(true);
      expect(saveRes.inMemory).toBe(true);

      const loaded = await getProject('mem_p1');
      expect(loaded).toEqual(fallbackProject);

      const all = await getAllProjects();
      expect(all.some((p) => p.id === 'mem_p1')).toBe(true);

      await deleteProject('mem_p1');
      expect(await getProject('mem_p1')).toBeNull();
    } finally {
      globalThis.indexedDB = origIndexedDB;
      await initProjectStore();
    }
  });
});
