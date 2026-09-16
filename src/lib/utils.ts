export const DEFAULT_CAMPAIGN_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230f172a"/><stop offset="50%" stop-color="%231e293b"/><stop offset="100%" stop-color="%23020617"/></linearGradient><linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><rect width="800" height="400" fill="url(%23bg)"/><rect x="20" y="20" width="760" height="360" rx="20" fill="none" stroke="%23334155" stroke-width="2" stroke-dasharray="8 8"/><path d="M400 110 L560 190 L400 270 L240 190 Z" fill="none" stroke="url(%23accent)" stroke-width="8" stroke-linejoin="round"/><path d="M400 210 L500 260 V290 L400 340 L300 290 V260 Z" fill="url(%23accent)" opacity="0.25"/><circle cx="400" cy="190" r="28" fill="url(%23accent)"/><text x="400" y="325" fill="%23f8fafc" font-family="system-ui, sans-serif" font-size="20" font-weight="800" text-anchor="middle" letter-spacing="2">MATUUMU SCHOOL CAMPAIGN</text></svg>`;

export const formatUGX = (amount?: number | null) => {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : Number(amount) || 0;
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('256') && digits.length >= 12) {
    return '+' + digits.slice(0, 12);
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return '+256' + digits.slice(1, 10);
  }
  if (digits.length === 9) {
    return '+256' + digits;
  }
  if (String(phone).trim().startsWith('+')) {
    return '+' + digits;
  }
  return '+' + digits;
}

export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const csvContent = [
    keys.join(','),
    ...rows.map(row => 
      keys.map(k => {
        let val = row[k];
        if (val === null || val === undefined) val = '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Safely converts any Firestore timestamp representation (Timestamp object, number milliseconds, string, Date)
 * into a standard JS Date object.
 */
export function safeGetDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  
  // 1. If it has a toDate method (Firestore Timestamp)
  if (typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  
  // 2. If it has seconds / nanoseconds properties (raw serialized Timestamp)
  if (typeof dateValue.seconds === 'number') {
    return new Date(dateValue.seconds * 1000 + Math.floor((dateValue.nanoseconds || 0) / 1000000));
  }
  
  // 3. If it is already a Date object
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // 4. If it is a number (milliseconds)
  if (typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  
  // 5. If it is a string (ISO, timestamp string, etc.)
  if (typeof dateValue === 'string') {
    if (/^\d+$/.test(dateValue)) {
      return new Date(Number(dateValue));
    }
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  
  return new Date();
}

/**
 * Safely formats any timestamp value into local date string.
 */
export function safeFormatDate(dateValue: any, options?: Intl.DateTimeFormatOptions): string {
  if (!dateValue) return '';
  const dateObj = safeGetDate(dateValue);
  const defaultOptions: Intl.DateTimeFormatOptions = options || { day: 'numeric', month: 'short', year: 'numeric' };
  return dateObj.toLocaleDateString('en-GB', defaultOptions);
}


