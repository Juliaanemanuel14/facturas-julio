import * as XLSX from 'xlsx';

export interface ExtractoRow {
  'Razón Social': string;
  'Banco': string;
  'Fecha': string;
  'Descripción': string;
  'Débito': number;
  'Crédito': number;
  'Leyenda / Referencia': string;
  'Saldo': number;
}

export interface InputFile {
  name: string;
  buffer: Buffer;
}

const MES_MAP: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', set: '09', oct: '10', nov: '11', dic: '12',
};

function decodeBuffer(buffer: Buffer): string {
  // Heurística simple: detectar UTF-8 vs Latin-1.
  // Si hay bytes >= 0x80 que rompen UTF-8, decodificamos como latin1.
  const utf8 = buffer.toString('utf-8');
  if (utf8.includes('�')) {
    return buffer.toString('latin1');
  }
  return utf8;
}

function detectSeparator(headerLine: string): string {
  const candidates = [';', '\t', ','];
  let best = ';';
  let bestCount = 0;
  for (const c of candidates) {
    const count = (headerLine.match(new RegExp(c === '\t' ? '\\t' : c, 'g')) || []).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

function splitLine(line: string, sep: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map(c => c.trim());
}

function parseDelimited(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  // buscar la primera línea con separador suficiente
  const headerIdx = lines.findIndex(l => /[;\t,]/.test(l) && l.toLowerCase().includes('fecha'));
  if (headerIdx === -1) return [];
  const sep = detectSeparator(lines[headerIdx]);
  const out: string[][] = [];
  for (let i = headerIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    out.push(splitLine(line, sep));
  }
  return out;
}

function parseNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }
  let s = String(value).trim();
  if (!s) return 0;

  // Paréntesis = negativo (estilo contable)
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  // Quitar símbolo de moneda y espacios
  s = s.replace(/\$/g, '').replace(/\s+/g, '');

  // Detectar formato europeo (1.234,56) vs anglo (1,234.56)
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // formato europeo
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // formato anglo
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // sólo coma -> decimal
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // else: sólo punto o ningún separador -> ya es válido

  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function formatDate(value: any): string {
  if (value === null || value === undefined || value === '') return '';

  // Date object (puede venir de XLSX)
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${pad2(value.getDate())}-${pad2(value.getMonth() + 1)}-${value.getFullYear()}`;
  }

  // Número serial de Excel
  if (typeof value === 'number' && isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d && d.y) return `${pad2(d.d)}-${pad2(d.m)}-${d.y}`;
  }

  const s = String(value).trim();
  if (!s) return '';

  // dd-mmm-yyyy (ej. 30-mar-2026)
  const mAbbr = s.match(/^(\d{1,2})[-\/]([a-zA-Záéíóú]{3,4})[-\/](\d{2,4})$/);
  if (mAbbr) {
    const day = pad2(parseInt(mAbbr[1], 10));
    const monKey = mAbbr[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 3);
    const month = MES_MAP[monKey];
    let year = mAbbr[3];
    if (year.length === 2) year = '20' + year;
    if (month) return `${day}-${month}-${year}`;
  }

  // dd/mm/yyyy o d/m/yyyy o dd-mm-yyyy
  const mNum = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mNum) {
    const day = pad2(parseInt(mNum[1], 10));
    const month = pad2(parseInt(mNum[2], 10));
    let year = mNum[3];
    if (year.length === 2) year = '20' + year;
    return `${day}-${month}-${year}`;
  }

  return s;
}

function findHeaderIndex(headers: string[], options: string[]): number {
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const normOpts = options.map(norm);
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (normOpts.includes(h)) return i;
  }
  // contains
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (normOpts.some(o => h.includes(o))) return i;
  }
  return -1;
}

interface ParsedFile {
  bankName: string;
  razonSocial: string;
  rows: ExtractoRow[];
}

function detectBank(filename: string, content?: string): string {
  const upper = filename.toUpperCase();
  if (upper.includes('CIUDAD')) return 'Ciudad';
  if (upper.includes('GALICIA')) return 'Galicia';
  if (upper.includes('SANTANDER')) return 'Santander';
  if (upper.includes('PROVINCIA')) return 'Provincia';
  if (upper.includes('NACION') || upper.includes('NACIÓN')) return 'Nacion';
  if (upper.includes('PROVINCIA')) return 'Provincia';
  return 'Desconocido';
}

const RAZON_SOCIAL_MAP: Array<[RegExp, string]> = [
  [/9\s*REINAS/i, '9Reinas'],
  [/PIBE\s*DORREGO/i, 'El Pibe Dorrego'],
  [/SALON\s*RECOVA|SALON\s*LA\s*RECOVA/i, 'Salon La Recova'],
  [/GESTION\s*POLO/i, 'Gestion Polo'],
  [/GESTION\s*RRHH|GESTION\s*RR/i, 'Gestion RR'],
  [/ARAUKEN/i, 'Arauken'],
  [/BAYONNA/i, 'Bayonna'],
  [/CAMPOLUOGO/i, 'Campoluogo'],
  [/CONCASSE/i, 'Concasse'],
  [/CRUZZAPOLO/i, 'Cruzzapolo'],
  [/ESCABECHE/i, 'Escabeche'],
  [/FLAMBE/i, 'Flambe'],
  [/MINCE/i, 'Mince'],
  [/MOJAMA/i, 'Mojama'],
  [/MUSSELINA/i, 'Musselina'],
  [/PARMENTTIER/i, 'Parmenttier'],
  [/PERSEO/i, 'Perseo'],
  [/RABBLE/i, 'Rabble'],
  [/RISSOLAR/i, 'Rissolar'],
  [/SOLPEN/i, 'Solpen'],
];

function detectRazonSocial(filename: string): string {
  for (const [re, name] of RAZON_SOCIAL_MAP) {
    if (re.test(filename)) return name;
  }
  // fallback: primer token en mayúsculas del nombre
  const cleaned = filename.replace(/\.[^.]+$/, '').replace(/\(\d+\)/g, '').trim();
  return cleaned.split(/\s+/).slice(0, 2).join(' ') || 'Sin Identificar';
}

// ===== Parsers por banco =====

function parseCiudad(filename: string, text: string): ParsedFile {
  const rows = parseDelimited(text);
  const out: ExtractoRow[] = [];
  if (rows.length < 2) return { bankName: 'Ciudad', razonSocial: detectRazonSocial(filename), rows: out };
  const headers = rows[0];
  const idxFecha = findHeaderIndex(headers, ['fecha']);
  const idxMonto = findHeaderIndex(headers, ['monto', 'importe']);
  const idxDesc = findHeaderIndex(headers, ['descripcion', 'descripción']);
  const idxSaldo = findHeaderIndex(headers, ['saldo']);
  const razonSocial = detectRazonSocial(filename);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const fecha = formatDate(r[idxFecha]);
    if (!fecha) continue;
    const monto = parseNumber(r[idxMonto]);
    const desc = (r[idxDesc] || '').trim();
    const saldo = parseNumber(r[idxSaldo]);
    if (!desc && monto === 0) continue;
    out.push({
      'Razón Social': razonSocial,
      'Banco': 'Ciudad',
      'Fecha': fecha,
      'Descripción': desc,
      'Débito': monto < 0 ? Math.abs(monto) : 0,
      'Crédito': monto > 0 ? monto : 0,
      'Leyenda / Referencia': '-',
      'Saldo': saldo,
    });
  }
  return { bankName: 'Ciudad', razonSocial, rows: out };
}

function parseGalicia(filename: string, text: string): ParsedFile {
  const rows = parseDelimited(text);
  const out: ExtractoRow[] = [];
  if (rows.length < 2) return { bankName: 'Galicia', razonSocial: detectRazonSocial(filename), rows: out };
  const headers = rows[0];
  const idxFecha = findHeaderIndex(headers, ['fecha']);
  const idxDesc = findHeaderIndex(headers, ['descripcion', 'descripción']);
  const idxDeb = findHeaderIndex(headers, ['debitos', 'débitos']);
  const idxCre = findHeaderIndex(headers, ['creditos', 'créditos']);
  const idxSaldo = findHeaderIndex(headers, ['saldo']);
  const idxLey1 = findHeaderIndex(headers, ['leyendas adicionales1', 'leyendas adicionales 1']);
  const idxLey2 = findHeaderIndex(headers, ['leyendas adicionales2', 'leyendas adicionales 2']);
  const idxConcept = findHeaderIndex(headers, ['concepto']);
  const razonSocial = detectRazonSocial(filename);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const fecha = formatDate(r[idxFecha]);
    if (!fecha) continue;
    const desc = (r[idxDesc] || '').trim();
    const debito = parseNumber(r[idxDeb]);
    const credito = parseNumber(r[idxCre]);
    const saldo = parseNumber(r[idxSaldo]);

    // Leyenda: priorizar Leyendas Adicionales1, fallback a 2
    let leyenda = '';
    if (idxLey1 >= 0 && r[idxLey1]) leyenda = r[idxLey1].trim();
    if (!leyenda && idxLey2 >= 0 && r[idxLey2]) leyenda = r[idxLey2].trim();

    if (!desc && debito === 0 && credito === 0) continue;

    out.push({
      'Razón Social': razonSocial,
      'Banco': 'Galicia',
      'Fecha': fecha,
      'Descripción': desc,
      'Débito': debito,
      'Crédito': credito,
      'Leyenda / Referencia': leyenda || '-',
      'Saldo': saldo,
    });
  }
  return { bankName: 'Galicia', razonSocial, rows: out };
}

function parseSantander(filename: string, text: string): ParsedFile {
  const rows = parseDelimited(text);
  const out: ExtractoRow[] = [];
  if (rows.length < 2) return { bankName: 'Santander', razonSocial: detectRazonSocial(filename), rows: out };
  const headers = rows[0];
  const idxFecha = findHeaderIndex(headers, ['fecha']);
  const idxConcepto = findHeaderIndex(headers, ['concepto']);
  const idxImporte = findHeaderIndex(headers, ['importe pesos', 'importe']);
  const idxSaldo = findHeaderIndex(headers, ['saldo pesos', 'saldo']);
  const razonSocial = detectRazonSocial(filename);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const fecha = formatDate(r[idxFecha]);
    if (!fecha) continue;
    const desc = (r[idxConcepto] || '').trim();
    const importe = parseNumber(r[idxImporte]);
    const saldo = parseNumber(r[idxSaldo]);
    if (!desc && importe === 0) continue;
    out.push({
      'Razón Social': razonSocial,
      'Banco': 'Santander',
      'Fecha': fecha,
      'Descripción': desc,
      'Débito': importe < 0 ? Math.abs(importe) : 0,
      'Crédito': importe > 0 ? importe : 0,
      'Leyenda / Referencia': '-',
      'Saldo': saldo,
    });
  }
  return { bankName: 'Santander', razonSocial, rows: out };
}

function parseXLSGeneric(filename: string, buffer: Buffer): ParsedFile {
  const bank = detectBank(filename);
  const razonSocial = detectRazonSocial(filename);
  const out: ExtractoRow[] = [];

  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { bankName: bank, razonSocial, rows: out };
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false, defval: '', raw: true });

  // Buscar la fila de header
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i].map(c => String(c || '').toLowerCase());
    if (row.some(c => c.includes('fecha')) && row.some(c => c.includes('importe') || c.includes('debito') || c.includes('débito') || c.includes('credito') || c.includes('crédito') || c.includes('monto'))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return { bankName: bank, razonSocial, rows: out };

  const headers = data[headerRowIdx].map((c: any) => String(c || ''));
  const idxFecha = findHeaderIndex(headers, ['fecha']);
  const idxDesc = findHeaderIndex(headers, ['concepto', 'descripcion', 'descripción']);
  const idxImporte = findHeaderIndex(headers, ['importe', 'monto']);
  const idxDeb = findHeaderIndex(headers, ['debitos', 'débitos', 'debito', 'débito']);
  const idxCre = findHeaderIndex(headers, ['creditos', 'créditos', 'credito', 'crédito']);
  const idxSaldo = findHeaderIndex(headers, ['saldo']);

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length === 0) continue;
    const rawFecha = r[idxFecha];
    if (rawFecha === '' || rawFecha === undefined || rawFecha === null) continue;
    const fecha = formatDate(rawFecha);
    if (!fecha || !/^\d{2}-\d{2}-\d{4}$/.test(fecha)) continue;

    const desc = String(r[idxDesc] ?? '').trim();
    const saldo = parseNumber(r[idxSaldo]);

    let debito = 0;
    let credito = 0;
    if (idxImporte !== -1) {
      const importe = parseNumber(r[idxImporte]);
      if (importe < 0) debito = Math.abs(importe);
      else if (importe > 0) credito = importe;
    } else {
      debito = parseNumber(r[idxDeb]);
      credito = parseNumber(r[idxCre]);
    }

    if (!desc && debito === 0 && credito === 0) continue;

    out.push({
      'Razón Social': razonSocial,
      'Banco': bank,
      'Fecha': fecha,
      'Descripción': desc,
      'Débito': debito,
      'Crédito': credito,
      'Leyenda / Referencia': '-',
      'Saldo': saldo,
    });
  }
  return { bankName: bank, razonSocial, rows: out };
}

export function processExtractoFile(file: InputFile): ParsedFile {
  const bank = detectBank(file.name);
  const ext = file.name.toLowerCase().split('.').pop() || '';

  if (ext === 'xlsx') {
    return parseXLSGeneric(file.name, file.buffer);
  }

  // .xls puede ser real (Provincia, Nacion) o texto (Santander)
  if (ext === 'xls') {
    // chequear bytes mágicos de OLE2 / ZIP
    const sig = file.buffer.slice(0, 8);
    const isOle = sig[0] === 0xd0 && sig[1] === 0xcf && sig[2] === 0x11 && sig[3] === 0xe0;
    const isZip = sig[0] === 0x50 && sig[1] === 0x4b;
    if (isOle || isZip) {
      return parseXLSGeneric(file.name, file.buffer);
    }
    // fall-through: tratar como TSV/CSV
    const text = decodeBuffer(file.buffer);
    if (bank === 'Santander') return parseSantander(file.name, text);
    return parseXLSGeneric(file.name, file.buffer);
  }

  // CSV / TSV
  const text = decodeBuffer(file.buffer);
  if (bank === 'Ciudad') return parseCiudad(file.name, text);
  if (bank === 'Galicia') return parseGalicia(file.name, text);
  if (bank === 'Santander') return parseSantander(file.name, text);
  // fallback genérico para CSV
  return parseGalicia(file.name, text);
}

export function processExtractos(files: InputFile[]): ExtractoRow[] {
  const all: ExtractoRow[] = [];
  for (const f of files) {
    try {
      const parsed = processExtractoFile(f);
      all.push(...parsed.rows);
    } catch (err) {
      console.error('Error procesando', f.name, err);
    }
  }
  return all;
}
