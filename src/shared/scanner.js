const shiftedDigits = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0' };

function normalizeScannerValue(value) {
  const trimmed = String(value ?? '').trim();
  return /^[!@#$%^&*()]+$/.test(trimmed) ? [...trimmed].map(character => shiftedDigits[character]).join('') : trimmed;
}

if (typeof module !== 'undefined') module.exports = { normalizeScannerValue };
if (typeof window !== 'undefined') window.ScannerInput = { normalizeScannerValue };
