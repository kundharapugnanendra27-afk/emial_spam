import {
  EmailInput,
  ExtractedFeatures,
  STRUCTURAL_FEATURE_NAMES,
  StructuralFeatureVector,
} from './types';

const SUSPICIOUS_TLDS = new Set([
  'xyz',
  'top',
  'ru',
  'tk',
  'ml',
  'ga',
  'cf',
  'click',
  'zip',
  'info',
  'club',
  'work',
  'gq',
  'cam',
  'rest',
  'su',
  'cc',
]);

const KNOWN_BRAND_TOKENS = [
  'paypal',
  'microsoft',
  'office365',
  'outlook',
  'google',
  'workspace',
  'apple',
  'icloud',
  'amazon',
  'chase',
  'wellsfargo',
  'bankofamerica',
  'citibank',
  'docusign',
  'okta',
  'dropbox',
  'stripe',
  'fedex',
  'dhl',
  'ups',
];

const TRUSTED_ROOT_DOMAINS = new Set([
  'microsoft.com',
  'google.com',
  'paypal.com',
  'docusign.com',
  'okta.com',
  'chase.com',
  'amazon.com',
  'aws.amazon.com',
  'github.com',
  'slack.com',
  'stripe.com',
  'fedex.com',
  'ups.com',
  'acmecorp.com',
  'northstarhealth.org',
  'vanguardops.io',
]);

const URGENCY_TERMS = [
  'urgent',
  'immediately',
  'suspended',
  'suspend',
  'locked',
  'deactivate',
  'deactivation',
  'terminated',
  'expire',
  'expires',
  'within 24',
  '24 hours',
  '12 hours',
  'final notice',
  'action required',
  'unauthorized',
  'breach',
  'compromised',
  'frozen',
  'warning',
  'critical alert',
];

const CREDENTIAL_ASK_TERMS = [
  'password',
  'passcode',
  'verify',
  'login',
  'sign in',
  'signin',
  'log in',
  'credential',
  'credentials',
  'ssn',
  'social security',
  'routing number',
  'bank account',
  'wire transfer',
  'gift card',
  'otp',
  'mfa',
  '2fa',
  'confirm identity',
  'reactivate',
  'unlock',
  'reset link',
  'validate',
  'billing update',
  'payment declined',
];

const URL_REGEX = /https?:\/\/[^\s<>"')]+/gi;
const IPV4_URL_REGEX = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/i;

export function extractDomain(email: string): string {
  const cleaned = email.trim().toLowerCase();
  const atIdx = cleaned.lastIndexOf('@');
  if (atIdx === -1) return '';
  return cleaned.slice(atIdx + 1).replace(/[>\s]/g, '');
}

export function getRootDomain(domain: string): string {
  const parts = domain.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  return parts.slice(-2).join('.');
}

function extractUrlHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    const stripped = url.replace(/^https?:\/\//i, '');
    return stripped.split('/')[0].split(':')[0].toLowerCase();
  }
}

function computeByteEntropy(input: string): number {
  if (!input.length) return 0;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const counts = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) {
    counts[bytes[i]]++;
  }
  let entropy = 0;
  for (let b = 0; b < 256; b++) {
    if (counts[b] > 0) {
      const p = counts[b] / bytes.length;
      entropy -= p * Math.log2(p);
    }
  }
  // Max theoretical entropy is 8 bits/byte; typical English text is ~4.1-4.8
  return entropy;
}

/**
 * Generates UTF-8 byte-level n-grams (3-grams and 4-grams) represented as readable
 * byte tokens so Naive Bayes captures obfuscated words, homoglyphs, punycode, and URL patterns.
 */
export function extractByteNgrams(text: string, maxNgrams = 240): string[] {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const encoder = new TextEncoder();
  const bytes = encoder.encode(normalized);
  const grams: string[] = [];

  const limit = Math.min(bytes.length, 900);
  for (let n = 3; n <= 4; n++) {
    for (let i = 0; i <= limit - n; i++) {
      let readable = '';
      let hasNonAscii = false;
      for (let j = 0; j < n; j++) {
        const b = bytes[i + j];
        if (b >= 33 && b <= 126) {
          readable += String.fromCharCode(b);
        } else if (b === 32) {
          readable += '_';
        } else {
          hasNonAscii = true;
          readable += `\\x${b.toString(16).padStart(2, '0')}`;
        }
      }
      // Skip pure whitespace padding
      if (readable === '___' || readable === '____') continue;
      grams.push(hasNonAscii ? `b${n}:utf8:${readable}` : `b${n}:${readable}`);
      if (grams.length >= maxNgrams) return grams;
    }
  }
  return grams;
}

export function tokenizeText(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, (u) => {
      const host = extractUrlHost(u);
      return ` url_host_${host.replace(/[^a-z0-9.-]/g, '')} `;
    })
    .replace(/[^a-z0-9@._-]/g, ' ');

  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/^[._-]+|[._-]+$/g, ''))
    .filter((w) => w.length >= 2 && w.length <= 40);

  const tokens: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }
  return tokens;
}

export function extractEmailFeatures(email: EmailInput): ExtractedFeatures {
  const combinedText = `${email.subject}\n${email.body}`;
  const lowerCombined = combinedText.toLowerCase();
  const urls = Array.from(new Set(combinedText.match(URL_REGEX) ?? []));

  const senderDomain = extractDomain(email.senderEmail);
  const replyToDomain = extractDomain(email.replyToEmail);
  const senderRoot = getRootDomain(senderDomain);
  const replyRoot = getRootDomain(replyToDomain);

  // 1. IPv4 URL literal
  const hasIpUrl = urls.some((u) => IPV4_URL_REGEX.test(u)) ? 1 : 0;

  // 2. Suspicious TLD ratio
  let suspTldCount = 0;
  let obfuscationPts = 0;
  for (const url of urls) {
    const host = extractUrlHost(url);
    const parts = host.split('.');
    const tld = parts[parts.length - 1] ?? '';
    if (SUSPICIOUS_TLDS.has(tld)) suspTldCount++;
    if (url.includes('@')) obfuscationPts += 1;
    if (/%[0-9a-f]{2}/i.test(url)) obfuscationPts += 0.7;
    if (host.includes('xn--')) obfuscationPts += 1;
    if (parts.length >= 4) obfuscationPts += 0.6;
    if (/(bit\.ly|tinyurl\.com|t\.co|rb\.gy|cutt\.ly)/i.test(host)) obfuscationPts += 0.7;
    if (/\d/.test(host) && KNOWN_BRAND_TOKENS.some((b) => host.includes(b.slice(0, 4)))) {
      obfuscationPts += 0.8;
    }
  }
  const suspiciousTldRatio = urls.length > 0 ? Math.min(1, suspTldCount / urls.length) : 0;
  const urlCountNorm = Math.min(1, urls.length / 5);
  const urlObfuscationScore = urls.length > 0 ? Math.min(1, obfuscationPts / (urls.length * 1.2)) : 0;

  // 5. Domain mismatch (Reply-To differs OR known brand mentioned in senderName/subject while sender domain doesn't match)
  let mismatch = 0;
  if (replyToDomain && senderDomain && replyRoot !== senderRoot) {
    mismatch = 1;
  } else {
    const displayAndSubj = `${email.senderName} ${email.subject}`.toLowerCase();
    for (const brand of KNOWN_BRAND_TOKENS) {
      if (displayAndSubj.includes(brand) && !senderDomain.includes(brand)) {
        mismatch = 0.9;
        break;
      }
    }
  }

  // Also check if URL host spoofs a brand not matching sender domain
  for (const url of urls) {
    const host = extractUrlHost(url);
    for (const brand of KNOWN_BRAND_TOKENS) {
      if (host.includes(brand) && !host.endsWith(`${brand}.com`) && !TRUSTED_ROOT_DOMAINS.has(getRootDomain(host))) {
        mismatch = Math.max(mismatch, 0.95);
      }
    }
  }

  // 6. Auth failure score
  const authScores = [email.spf, email.dkim, email.dmarc].map((st) =>
    st === 'fail' ? 1 : st === 'none' ? 0.55 : 0
  );
  const authFailScore = (authScores[0] + authScores[1] + authScores[2]) / 3;

  // 7. Urgency lexicon density
  let urgencyHits = 0;
  for (const term of URGENCY_TERMS) {
    if (lowerCombined.includes(term)) urgencyHits++;
  }
  const urgencyDensity = Math.min(1, urgencyHits / 4);

  // 8. Credential ask density
  let credHits = 0;
  for (const term of CREDENTIAL_ASK_TERMS) {
    if (lowerCombined.includes(term)) credHits++;
  }
  const credentialAskDensity = Math.min(1, credHits / 4);

  // 9. Uppercase ratio
  const alphaChars = combinedText.replace(/[^a-zA-Z]/g, '');
  const upperChars = combinedText.replace(/[^A-Z]/g, '');
  const uppercaseRatio = alphaChars.length > 0 ? Math.min(1, (upperChars.length / alphaChars.length) * 2.2) : 0;

  // 10. Non-ASCII byte ratio (detects Cyrillic/Unicode homoglyphs and raw UTF-8 obfuscation)
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(`${email.senderName} ${email.senderEmail} ${combinedText}`);
  let nonAsciiCount = 0;
  for (let i = 0; i < rawBytes.length; i++) {
    if (rawBytes[i] > 127) nonAsciiCount++;
  }
  const nonAsciiByteRatio = rawBytes.length > 0 ? Math.min(1, (nonAsciiCount / rawBytes.length) * 10) : 0;

  // 11. Digit substitution / leetspeak inside words (e.g., p4ypal, micros0ft, ver1fy)
  const rawWords = `${email.senderEmail} ${combinedText}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let leetCount = 0;
  for (const w of rawWords) {
    if (/^[a-z]+\d+[a-z]+[a-z0-9]*$/.test(w)) {
      if (!/^(365|2fa|mfa|w2|1099|oauth2|utf8|sha256|v2|v3|b2b|ed25519|x64|win32)$/.test(w)) {
        leetCount++;
      }
    }
  }
  const digitSubstitutionScore = Math.min(1, leetCount / 2);

  // 12. HTML form/script payload signals
  const htmlOrScriptSignal = /(<form|<script|javascript:|data:text\/html|onerror=|onload=|action=["']http)/i.test(
    combinedText
  )
    ? 1
    : 0;

  // 13. Byte entropy over URLs or body
  const entropySource = urls.length > 0 ? urls.join(' ') : combinedText;
  const entropy = computeByteEntropy(entropySource);
  const byteEntropyNorm = Math.min(1, Math.max(0, (entropy - 3.6) / 2.2));

  // 14. Legitimate header trust signal (SPF & DKIM pass + known root domain + no mismatch + no IP/obfuscated URL)
  const allAuthPass = email.spf === 'pass' && email.dkim === 'pass';
  const trustedDomain = TRUSTED_ROOT_DOMAINS.has(senderRoot);
  const legitHeaderTrust =
    allAuthPass && mismatch < 0.2 && hasIpUrl === 0 && urlObfuscationScore < 0.25
      ? trustedDomain
        ? 1.0
        : 0.65
      : 0;

  const structural: StructuralFeatureVector = {
    hasIpUrl,
    suspiciousTldRatio,
    urlCountNorm,
    urlObfuscationScore,
    domainMismatch: mismatch,
    authFailScore,
    urgencyDensity,
    credentialAskDensity,
    uppercaseRatio,
    nonAsciiByteRatio,
    digitSubstitutionScore,
    htmlOrScriptSignal,
    byteEntropyNorm,
    legitHeaderTrust,
  };

  const structuralArray = STRUCTURAL_FEATURE_NAMES.map((k) => structural[k]);

  const tokenInput = `${email.senderName} ${senderDomain} ${email.subject} ${email.body}`;
  const tokens = tokenizeText(tokenInput);
  const byteInput = `${email.senderEmail} ${email.subject} ${urls.join(' ')} ${email.body}`;
  const byteNgrams = extractByteNgrams(byteInput);

  return {
    tokens,
    byteNgrams,
    urls,
    structural,
    structuralArray,
    byteLength: rawBytes.length,
  };
}

export function findSuspiciousSpans(email: EmailInput): string[] {
  const spans = new Set<string>();
  const combined = `${email.subject}\n${email.body}`;
  const urls = combined.match(URL_REGEX) ?? [];
  for (const u of urls) {
    const host = extractUrlHost(u);
    const tld = host.split('.').pop() ?? '';
    if (
      IPV4_URL_REGEX.test(u) ||
      SUSPICIOUS_TLDS.has(tld) ||
      u.includes('@') ||
      host.includes('xn--') ||
      /%[0-9a-f]{2}/i.test(u) ||
      (/\d/.test(host) && !TRUSTED_ROOT_DOMAINS.has(getRootDomain(host)))
    ) {
      spans.add(u);
    }
  }
  const lower = combined.toLowerCase();
  for (const term of [...URGENCY_TERMS, ...CREDENTIAL_ASK_TERMS]) {
    if (lower.includes(term)) {
      spans.add(term);
    }
  }
  const words = combined.split(/\s+/);
  for (const w of words) {
    if (/[^\x00-\x7F]/.test(w)) {
      spans.add(w);
    }
    if (/^[a-z]+\d+[a-z]+$/i.test(w) && !/^(365|2fa|mfa|oauth2|utf8|b2b)$/i.test(w)) {
      spans.add(w);
    }
  }
  return Array.from(spans).slice(0, 10);
}
