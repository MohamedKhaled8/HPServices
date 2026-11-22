import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  mergeFoldersByPath,
  getPathParts,
  getParentPath,
  getPathLastName,
  filterOutFolderAndDescendants,
} from './folderUtils.ts';

describe('folderUtils', () => {
  it('merges folders by path deduplicating properly', () => {
    const listA: any[] = [{ path: 'unit1', name: 'Unit 1' }];
    const listB: any[] = [{ path: 'unit1', name: 'Unit 1 Renamed' }, { path: 'unit2', name: 'Unit 2' }];
    const merged = mergeFoldersByPath(listA, listB);
    assert.strictEqual(merged.length, 2);
    assert.strictEqual(merged.find(f => f.path === 'unit1')?.name, 'Unit 1 Renamed');
  });

  it('correctly parses path parts, parent path, and last name', () => {
    assert.deepStrictEqual(getPathParts('math/unit1/lesson1'), ['math', 'unit1', 'lesson1']);
    assert.strictEqual(getParentPath('math/unit1/lesson1'), 'math/unit1');
    assert.strictEqual(getParentPath('math'), '');
    assert.strictEqual(getPathLastName('math/unit1/lesson1'), 'lesson1');
    assert.strictEqual(getPathLastName(''), '');
  });

  it('filters out target folder and all subfolders/files immediately (optimistic deletion)', () => {
    const folders = [
      { path: 'physics', name: 'Physics' },
      { path: 'physics/term1', name: 'Term 1' },
      { path: 'physics/term1/ch1', name: 'Chapter 1' },
      { path: 'chemistry', name: 'Chemistry' },
      { path: 'chemistry/term1', name: 'Chem Term 1' },
    ];

    const result = filterOutFolderAndDescendants(folders, 'physics/term1');

    assert.strictEqual(result.length, 3);
    assert.deepStrictEqual(result.map(f => f.path), ['physics', 'chemistry', 'chemistry/term1']);
  });

  it('filters files inside target folder and nested subfolders', () => {
    const files = [
      { id: '1', name: 'intro.pdf', folderPath: 'physics' },
      { id: '2', name: 'hw1.pdf', folderPath: 'physics/term1' },
      { id: '3', name: 'hw2.pdf', folderPath: 'physics/term1/ch1' },
      { id: '4', name: 'chem.pdf', folderPath: 'chemistry' },
    ];

    const remainingFiles = filterOutFolderAndDescendants(files, 'physics/term1');

    assert.strictEqual(remainingFiles.length, 2);
    assert.deepStrictEqual(remainingFiles.map(f => f.id), ['1', '4']);
  });

  it('handles empty items or empty path gracefully without mutation', () => {
    const original = [{ path: 'folder1' }];
    assert.deepStrictEqual(filterOutFolderAndDescendants(original, ''), original);
    assert.deepStrictEqual(filterOutFolderAndDescendants([], 'folder1'), []);
  });
});
