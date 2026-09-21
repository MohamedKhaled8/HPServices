export interface ServicePaymentMethods {
  instaPay?: string;
  cashWallet?: string;
}

export type ServicePaymentConfigs = Record<string, ServicePaymentMethods | null | undefined>;

const STATIC_PAYMENT_NUMBERS = ['01050889591', '01017180923', 'raoufpk97@instapay'] as const;

export function getServicePaymentNumber(
  serviceId: string,
  method: string,
  configs: ServicePaymentConfigs
): string {
  if (method !== 'Vodafone' && method !== 'instaPay') {
    return '';
  }

  const methods = configs[serviceId];
  if (!methods) {
    return '';
  }

  const raw = method === 'instaPay' ? methods.instaPay : methods.cashWallet;
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  return raw.trim();
}

export function isLegacyStaticPaymentNumber(value: string): boolean {
  return STATIC_PAYMENT_NUMBERS.includes(value.trim() as (typeof STATIC_PAYMENT_NUMBERS)[number]);
}
