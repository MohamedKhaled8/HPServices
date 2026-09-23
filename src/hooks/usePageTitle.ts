import { useEffect } from 'react';

const BASE_TITLE = 'HP Services | منصة اتش بي سيرفيس';

/**
 * Sets the document title for SEO and browser tab.
 * Automatically appends the base brand name.
 * @param pageTitle - The specific page title (e.g., "تسجيل الدخول")
 * @param override - If true, uses pageTitle as-is without appending brand
 */
export function usePageTitle(pageTitle?: string, override?: boolean) {
  useEffect(() => {
    if (!pageTitle) {
      document.title = BASE_TITLE;
    } else if (override) {
      document.title = pageTitle;
    } else {
      document.title = `${pageTitle} | HP Services - اتش بي سيرفيس`;
    }
    return () => {
      document.title = BASE_TITLE;
    };
  }, [pageTitle, override]);
}

export default usePageTitle;
