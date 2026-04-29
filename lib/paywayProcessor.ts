import * as XLSX from 'xlsx';

export interface PaywayRow {
  'RAZON SOCIAL': string;
  'LOCAL': string;
  'FECHA DE VENTA': string;
  'TERMINAL': string;
  'MONTO BRUTO': number;
  'MONTO NETO': number;
  'TOTAL RET.': number;
  'RET IIBB': number;
  'TOTAL COM.': number;
  'COM. TOTAL': number;
  'IVA COM.': number;
  'PERCEP IVA': number;
}

export interface PaywayInputFile {
  name: string;
  buffer: Buffer;
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function formatDateValue(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;
  }
  if (typeof value === 'number' && isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d && d.y) return `${pad2(d.d)}/${pad2(d.m)}/${d.y}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const day = pad2(parseInt(m[1], 10));
    const month = pad2(parseInt(m[2], 10));
    let year = m[3];
    if (year.length === 2) year = '20' + year;
    return `${day}/${month}/${year}`;
  }
  return s;
}

function toNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  let s = String(value).trim();
  if (!s) return 0;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/\$/g, '').replace(/\s+/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function findHeaderIndex(headers: string[], options: string[]): number {
  const norm = (s: string) => (s || '').toString().toUpperCase().trim();
  const normOpts = options.map(norm);
  for (let i = 0; i < headers.length; i++) {
    if (normOpts.includes(norm(headers[i]))) return i;
  }
  return -1;
}

function findHeaderIndexes(headers: string[], prefix: string, excludeExact?: string[]): number[] {
  const out: number[] = [];
  const p = prefix.toUpperCase();
  const exclude = (excludeExact || []).map(s => s.toUpperCase());
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toString().toUpperCase();
    if (h.startsWith(p) && !exclude.includes(h)) out.push(i);
  }
  return out;
}

function processPaywayFile(file: PaywayInputFile): PaywayRow[] {
  const wb = XLSX.read(file.buffer, { type: 'buffer', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false, defval: '', raw: true });

  // Buscar fila de header (la que contiene "FECHA DE VENTA")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i].map((c: any) => String(c || '').toUpperCase());
    if (row.some(c => c.includes('FECHA DE VENTA')) && row.some(c => c.includes('MONTO BRUTO'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = data[headerIdx].map((c: any) => String(c || ''));
  const idxFecha = findHeaderIndex(headers, ['FECHA DE VENTA']);
  const idxTerminal = findHeaderIndex(headers, ['TERMINAL LOGICA', 'TERMINAL LÓGICA', 'TERMINAL']);
  const idxEstado = findHeaderIndex(headers, ['ESTADO']);
  const idxBruto = findHeaderIndex(headers, ['MONTO BRUTO']);
  const idxNeto = findHeaderIndex(headers, ['MONTO NETO']);
  const idxRet = findHeaderIndex(headers, ['TOTAL RETENCIONES (R)', 'TOTAL RETENCIONES']);
  const idxCosto = findHeaderIndex(headers, ['TOTAL COSTO DE SERVICIO']);
  const idxArancel = findHeaderIndex(headers, ['ARANCEL']);
  const idxIvaArancel = findHeaderIndex(headers, ['IVA ARANCEL']);
  const idxPerc = findHeaderIndex(headers, ['TOTAL PERCEPCIONES (P)', 'TOTAL PERCEPCIONES']);

  // RET IIBB = suma de R_INGRESOS BRUTOS por jurisdicción.
  // El export oficial excluye R_INGRESOS BRUTOS COMARB (es percepción del régimen multilateral, ya distribuida en cada jurisdicción).
  const idxsRetIIBB = findHeaderIndexes(headers, 'R_INGRESOS BRUTOS', ['R_INGRESOS BRUTOS COMARB']);

  const out: PaywayRow[] = [];
  for (let i = headerIdx + 1; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length === 0) continue;
    const rawFecha = r[idxFecha];
    if (rawFecha === '' || rawFecha === undefined || rawFecha === null) continue;

    // Filtrar por estado: aceptar Aprobada y Devuelto (las devoluciones aparecen
    // en el export oficial con MONTO BRUTO negativo). Otras (Rechazada, Pendiente, etc.) se excluyen.
    if (idxEstado !== -1) {
      const estado = String(r[idxEstado] || '').trim().toLowerCase();
      if (estado && estado !== 'aprobada' && estado !== 'devuelto' && estado !== 'devuelta') continue;
    }

    const fecha = formatDateValue(rawFecha);
    if (!fecha || !/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) continue;

    const terminal = String(r[idxTerminal] ?? '').trim();
    const bruto = toNumber(r[idxBruto]);
    if (bruto === 0 && !terminal) continue;

    const neto = toNumber(r[idxNeto]);
    const totalRet = toNumber(r[idxRet]);
    const totalCosto = toNumber(r[idxCosto]);
    const arancel = toNumber(r[idxArancel]);
    const ivaArancel = toNumber(r[idxIvaArancel]);
    const totalPerc = toNumber(r[idxPerc]);
    const retIIBB = idxsRetIIBB.reduce((s, idx) => s + toNumber(r[idx]), 0);

    out.push({
      'RAZON SOCIAL': '-',
      'LOCAL': '-',
      'FECHA DE VENTA': fecha,
      'TERMINAL': terminal,
      'MONTO BRUTO': bruto,
      'MONTO NETO': neto,
      'TOTAL RET.': totalRet,
      'RET IIBB': retIIBB,
      'TOTAL COM.': totalCosto,
      'COM. TOTAL': arancel,
      'IVA COM.': ivaArancel,
      'PERCEP IVA': totalPerc,
    });
  }
  return out;
}

export function processPaywayFiles(files: PaywayInputFile[]): PaywayRow[] {
  const all: PaywayRow[] = [];
  for (const f of files) {
    try {
      const rows = processPaywayFile(f);
      all.push(...rows);
    } catch (err) {
      console.error('Error procesando', f.name, err);
    }
  }
  return all;
}
