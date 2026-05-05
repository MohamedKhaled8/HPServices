/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** إن كانت `true` يُسمَح باختصارات DevTools في الإنتاج (تصحيح فقط) */
    readonly VITE_ALLOW_DEVTOOLS?: string
    readonly VITE_API_URL: string
    readonly REACT_APP_API_URL: string
    readonly VITE_SUPABASE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
