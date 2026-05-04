/**
 * تشفير حمولة طلبات الأتمتة في المتصفح (RSA-OAEP-256 + AES-256-GCM)
 * حتى لا تظهر بيانات الطالب نصًا صريحًا في Network → Payload.
 */

export type AutomationCryptoPublicResponse = {
  enabled: boolean;
  v?: number;
  publicKeySpkiPem?: string;
};

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
  const url = `${apiBase.replace(/\/$/, '')}/api/automation-crypto-public`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return { enabled: false };
  try {
    return (await res.json()) as AutomationCryptoPublicResponse;
  } catch {
    return { enabled: false };
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
