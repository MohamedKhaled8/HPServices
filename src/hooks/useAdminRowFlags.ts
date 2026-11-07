import { useState, useEffect, useRef, useCallback } from 'react';

export interface RowFlags {
  f1: boolean;
  f2: boolean;
  f3: boolean;
}

export function useAdminRowFlags() {
  const [toggledFlags, setToggledFlags] = useState<Record<string, RowFlags>>(() => {
    try {
      const saved = localStorage.getItem('admin_toggled_flags');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggledFlagsRef = useRef(toggledFlags);
  useEffect(() => {
    toggledFlagsRef.current = toggledFlags;
  }, [toggledFlags]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem('admin_toggled_flags', JSON.stringify(toggledFlags));
      } catch {
        // ignore
      }
    }, 320);
    return () => window.clearTimeout(id);
  }, [toggledFlags]);

  useEffect(() => {
    return () => {
      try {
        localStorage.setItem('admin_toggled_flags', JSON.stringify(toggledFlagsRef.current));
      } catch {
        // ignore
      }
    };
  }, []);

  const toggleFlag = useCallback((key: string, index: 1 | 2 | 3) => {
    setToggledFlags((prev) => ({
      ...prev,
      [key]: {
        f1: index === 1 ? !prev[key]?.f1 : !!prev[key]?.f1,
        f2: index === 2 ? !prev[key]?.f2 : !!prev[key]?.f2,
        f3: index === 3 ? !prev[key]?.f3 : !!prev[key]?.f3
      }
    }));
  }, []);

  return { toggledFlags, setToggledFlags, toggleFlag };
}

