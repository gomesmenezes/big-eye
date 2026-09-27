import { createHash } from 'node:crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }

  return value;
}

function maskString(key: string, value: string): string {
  const normalizedKey = key.toLowerCase();
  const digits = value.replace(/\D/g, '');

  if (normalizedKey === 'cpf' && /^\d{11}$/.test(digits)) {
    return `***.***.***-${digits.slice(-2)}`;
  }

  if (normalizedKey === 'cnpj' && /^\d{14}$/.test(digits)) {
    return `**.***.***/****-${digits.slice(-2)}`;
  }

  if (normalizedKey.includes('email') && value.includes('@')) {
    const [localPart, domain] = value.split('@');
    return `${localPart.slice(0, 1)}***@${domain}`;
  }

  if (
    normalizedKey.includes('telefone') ||
    normalizedKey.includes('phone') ||
    normalizedKey.includes('celular')
  ) {
    return `${'*'.repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`;
  }

  return value;
}

function maskValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    return maskString(key, value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskValue(key, item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((childKey) => [childKey, maskValue(childKey, value[childKey])]),
    );
  }

  return value;
}

export function maskInput(
  module: string,
  input: Record<string, unknown>,
): { masked: string; hash: string } {
  const canonicalInput = stableValue(input);
  const hash = createHash('sha256')
    .update(JSON.stringify({ module, input: canonicalInput }))
    .digest('hex');
  const maskedInput = Object.fromEntries(
    Object.keys(input)
      .sort()
      .map((key) => [key, maskValue(key, input[key])]),
  );
  const keys = Object.keys(maskedInput);
  const masked =
    keys.length === 1 && ['cpf', 'cnpj'].includes(keys[0] ?? '')
      ? String(maskedInput[keys[0] ?? ''])
      : JSON.stringify(maskedInput);

  return { masked, hash };
}
