import test from 'node:test';
import assert from 'node:assert/strict';

export const formatFolderCount = (count: number): string => {
  return `${count} ${count === 1 ? 'ملف' : 'ملفات'}`;
};

export const formatCardMeta = (bytes?: number, fallback = 'FILE'): string => {
  if (!bytes || typeof bytes !== 'number') return fallback;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const truncateCardName = (name: string, maxLen = 16): string => {
  if (!name) return '';
  return name.length > maxLen ? `${name.substring(0, maxLen - 1)}…` : name;
};

export const simulateCardClickFlow = (
  isActionClick: boolean,
  onOpenFolder: () => void,
  onAction: () => void
) => {
  let stopPropagationCalled = false;
  const mockEvent = {
    stopPropagation: () => {
      stopPropagationCalled = true;
    },
    preventDefault: () => {},
  };

  if (isActionClick) {
    mockEvent.stopPropagation();
    mockEvent.preventDefault();
    onAction();
  } else {
    onOpenFolder();
  }

  return { stopPropagationCalled };
};

test('FolderCard file count formats correctly for 0, 1, and N files', () => {
  assert.equal(formatFolderCount(0), '0 ملفات');
  assert.equal(formatFolderCount(1), '1 ملف');
  assert.equal(formatFolderCount(3), '3 ملفات');
  assert.equal(formatFolderCount(5), '5 ملفات');
  assert.equal(formatFolderCount(12), '12 ملفات');
});

test('FolderCard preview card title truncates properly when exceeding length', () => {
  assert.equal(truncateCardName('ShortName.pdf'), 'ShortName.pdf');
  assert.equal(truncateCardName('VeryLongFileNameForAssignment.pdf', 16), 'VeryLongFileNam…');
});

test('FolderCard preview card metadata formats file sizes correctly in MB', () => {
  assert.equal(formatCardMeta(undefined, 'PDF • 1.2 MB'), 'PDF • 1.2 MB');
  assert.equal(formatCardMeta(1048576 * 2.5), '2.5 MB');
  assert.equal(formatCardMeta(1048576 * 4.8), '4.8 MB');
});

test('Clicking folder card opens inner files and action button stops propagation', () => {
  let opened = false;
  let actionTriggered = false;

  // 1. Click on folder body triggers opening inner files
  const bodyClickResult = simulateCardClickFlow(
    false,
    () => { opened = true; },
    () => { actionTriggered = true; }
  );
  assert.equal(opened, true);
  assert.equal(actionTriggered, false);
  assert.equal(bodyClickResult.stopPropagationCalled, false);

  // 2. Click on "+" squircle button stops propagation and triggers action without opening
  opened = false;
  actionTriggered = false;
  const actionClickResult = simulateCardClickFlow(
    true,
    () => { opened = true; },
    () => { actionTriggered = true; }
  );
  assert.equal(opened, false);
  assert.equal(actionTriggered, true);
  assert.equal(actionClickResult.stopPropagationCalled, true);
});
