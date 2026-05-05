/**
 * تشفير حمولة طلبات الأتمتة في المتصفح (RSA-OAEP-256 + AES-256-GCM)
 * حتى لا تظهر بيانات الطالب نصًا صريحًا في Network → Payload.
 */

export type AutomationCryptoPublicResponse = {
  enabled: boolean;
  v?: number;
  publicKeySpkiPem?: string;
  /** فشل الشبكة أو CORS أو غير 200 — لا يُعاد بعدها لإرسال JSON صريح في الإنتاج */
  unreachable?: boolean;
  httpStatus?: number;
};

/** يقلل تكرار طلبات GET عند فشل CORS أو بطء الشبكة بعد أول نجاح في الجلسة */
const SESSION_SPKI_CACHE_KEY = 'eksc_automation_spki_pem_v1';

function readCachedSpkiPem(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const pem = sessionStorage.getItem(SESSION_SPKI_CACHE_KEY);
    if (pem && pem.includes('BEGIN PUBLIC KEY')) return pem;
  } catch {
    /* storage معطّل */
  }
  return null;
}

function writeCachedSpkiPem(pem: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_SPKI_CACHE_KEY, pem);
  } catch {
    /* quota / private */
  }
}

function pemSpkiToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem.split('\n').filter((l) => !l.includes('-----'));
  const b64 = lines.join('').replace(/\s/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  return btoa(binary);
}

export async function fetchAutomationCryptoPublic(apiBase: string): Promise<AutomationCryptoPublicResponse> {
  const cached = readCachedSpkiPem();
  if (cached) {
    return { enabled: true, v: 1, publicKeySpkiPem: cached, unreachable: false };
  }

  const url = `${apiBase.replace(/\/$/, '')}/api/automation-crypto-public`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit'
    });
    if (!res.ok) {
      return { enabled: false, unreachable: true, httpStatus: res.status };
    }
    const data = (await res.json()) as AutomationCryptoPublicResponse;
    if (data.publicKeySpkiPem && data.enabled) {
      writeCachedSpkiPem(data.publicKeySpkiPem);
    }
    return { ...data, unreachable: false };
  } catch {
    return { enabled: false, unreachable: true };
  }
}

export async function encryptAutomationPayloadEnvelope(
  publicKeySpkiPem: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto غير متاح');
  }
  const pem = publicKeySpkiPem.replace(/\r/g, '').trim();
  const spki = pemSpkiToArrayBuffer(pem);

  const rsaPub = await subtle.importKey(
    'spki',
    spki,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const rawAes = new Uint8Array(await subtle.exportKey('raw', aesKey));

  const wrappedKeyBuf = await subtle.encrypt({ name: 'RSA-OAEP' }, rsaPub, rawAes);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plain);
  const cipherBytes = new Uint8Array(cipherBuf);

  return {
    v: 1,
    wrappedKey: uint8ToBase64(new Uint8Array(wrappedKeyBuf)),
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(cipherBytes)
  };
}
