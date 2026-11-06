/**
 * Gerador de arquivo .xlsx (Excel) nativo, sem dependencias externas.
 *
 * Monta o pacote OOXML (um ZIP com XMLs) na mao. Usa metodo "store" (sem
 * compressao) no ZIP, o que dispensa qualquer lib de deflate e continua sendo
 * um .xlsx 100% valido para o Excel / Google Sheets / LibreOffice.
 *
 * Uso:
 *   exportarExcel("relatorio-emissoes", [
 *     { header: "ID", key: "id" },
 *     { header: "Data", key: "data", tipo: "data" },
 *     { header: "Preco total", key: "preco", tipo: "moeda" },
 *   ], linhas);
 */

export type TipoColuna = "texto" | "data" | "inteiro" | "moeda" | "decimal";

export interface ColunaExcel<T = any> {
  header: string;
  key: keyof T | string;
  tipo?: TipoColuna;
  /** largura em caracteres (opcional; default calculado pelo header) */
  largura?: number;
}

/* ------------------------------------------------------------------ */
/* Helpers XML                                                         */
/* ------------------------------------------------------------------ */

const esc = (v: unknown) =>
  String(v ?? "")
    // remove caracteres de controle que invalidam o XML
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 0 -> A, 25 -> Z, 26 -> AA ... */
function colLetra(i: number) {
  let s = "";
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** data (Date | "yyyy-mm-dd" | "dd/mm/yyyy") -> serial do Excel */
function serialData(v: any): number | null {
  if (v == null || v === "") return null;
  let y: number, m: number, d: number;
  if (v instanceof Date) {
    y = v.getFullYear();
    m = v.getMonth() + 1;
    d = v.getDate();
  } else {
    const s = String(v).trim();
    let mt = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mt) {
      y = +mt[1];
      m = +mt[2];
      d = +mt[3];
    } else {
      mt = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (!mt) return null;
      d = +mt[1];
      m = +mt[2];
      y = +mt[3];
    }
  }
  const ms = Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30);
  return Math.round(ms / 86400000);
}

/* ------------------------------------------------------------------ */
/* Estilos                                                             */
/* ------------------------------------------------------------------ */

// indices de cellXfs: 0 = normal, 1 = cabecalho, 2 = inteiro,
// 3 = moeda, 4 = decimal, 5 = data
const ESTILO: Record<TipoColuna, number> = {
  texto: 0,
  inteiro: 2,
  moeda: 3,
  decimal: 4,
  data: 5,
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4">
<numFmt numFmtId="164" formatCode="#,##0"/>
<numFmt numFmtId="165" formatCode="&quot;R$&quot;\\ #,##0.00"/>
<numFmt numFmtId="166" formatCode="#,##0.00"/>
<numFmt numFmtId="167" formatCode="dd/mm/yyyy"/>
</numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* ------------------------------------------------------------------ */
/* ZIP (metodo store, sem compressao)                                  */
/* ------------------------------------------------------------------ */

let crcTabela: Uint32Array | null = null;
function crc32(buf: Uint8Array) {
  if (!crcTabela) {
    crcTabela = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTabela[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTabela[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entrada {
  nome: string;
  dados: Uint8Array;
}

function zipar(entradas: Entrada[]): Blob {
  const enc = new TextEncoder();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let offset = 0;

  const u16 = (dv: DataView, p: number, v: number) => dv.setUint16(p, v, true);
  const u32 = (dv: DataView, p: number, v: number) => dv.setUint32(p, v, true);

  for (const e of entradas) {
    const nome = enc.encode(e.nome);
    const crc = crc32(e.dados);
    const tam = e.dados.length;

    const lh = new Uint8Array(30 + nome.length);
    const ldv = new DataView(lh.buffer);
    u32(ldv, 0, 0x04034b50);
    u16(ldv, 4, 20);
    u16(ldv, 6, 0x0800); // UTF-8
    u16(ldv, 8, 0); // store
    u16(ldv, 10, 0);
    u16(ldv, 12, 0);
    u32(ldv, 14, crc);
    u32(ldv, 18, tam);
    u32(ldv, 22, tam);
    u16(ldv, 26, nome.length);
    u16(ldv, 28, 0);
    lh.set(nome, 30);
    locais.push(lh, e.dados);

    const ch = new Uint8Array(46 + nome.length);
    const cdv = new DataView(ch.buffer);
    u32(cdv, 0, 0x02014b50);
    u16(cdv, 4, 20);
    u16(cdv, 6, 20);
    u16(cdv, 8, 0x0800);
    u16(cdv, 10, 0);
    u16(cdv, 12, 0);
    u16(cdv, 14, 0);
    u32(cdv, 16, crc);
    u32(cdv, 20, tam);
    u32(cdv, 24, tam);
    u16(cdv, 28, nome.length);
    u16(cdv, 30, 0);
    u16(cdv, 32, 0);
    u16(cdv, 34, 0);
    u16(cdv, 36, 0);
    u32(cdv, 38, 0);
    u32(cdv, 42, offset);
    ch.set(nome, 46);
    centrais.push(ch);

    offset += lh.length + tam;
  }

  const tamCentral = centrais.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  u32(edv, 0, 0x06054b50);
  u16(edv, 4, 0);
  u16(edv, 6, 0);
  u16(edv, 8, entradas.length);
  u16(edv, 10, entradas.length);
  u32(edv, 12, tamCentral);
  u32(edv, 16, offset);
  u16(edv, 20, 0);

  return new Blob([...locais, ...centrais, eocd], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* ------------------------------------------------------------------ */
/* Geracao da planilha                                                 */
/* ------------------------------------------------------------------ */

function montarSheet<T>(colunas: ColunaExcel<T>[], linhas: T[], nomeAba: string) {
  const cols = colunas
    .map((c, i) => {
      const w = c.largura ?? Math.min(40, Math.max(10, c.header.length + 4));
      return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
    })
    .join("");

  const partes: string[] = [];
  partes.push(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr>` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>` +
      `<cols>${cols}</cols><sheetData>`
  );

  // cabecalho
  partes.push(
    `<row r="1">` +
      colunas
        .map((c, i) => `<c r="${colLetra(i)}1" s="1" t="inlineStr"><is><t>${esc(c.header)}</t></is></c>`)
        .join("") +
      `</row>`
  );

  linhas.forEach((linha, idx) => {
    const r = idx + 2;
    const celulas = colunas
      .map((c, i) => {
        const ref = `${colLetra(i)}${r}`;
        const tipo = c.tipo ?? "texto";
        const s = ESTILO[tipo];
        const bruto = (linha as any)[c.key as string];

        if (bruto == null || bruto === "") return "";

        if (tipo === "data") {
          const serial = serialData(bruto);
          if (serial == null) return `<c r="${ref}" t="inlineStr"><is><t>${esc(bruto)}</t></is></c>`;
          return `<c r="${ref}" s="${s}"><v>${serial}</v></c>`;
        }

        if (tipo === "inteiro" || tipo === "moeda" || tipo === "decimal") {
          const n = Number(bruto);
          if (!isFinite(n)) return "";
          return `<c r="${ref}" s="${s}"><v>${n}</v></c>`;
        }

        return `<c r="${ref}" t="inlineStr"><is><t>${esc(bruto)}</t></is></c>`;
      })
      .join("");
    partes.push(`<row r="${r}">${celulas}</row>`);
  });

  const ultima = `${colLetra(colunas.length - 1)}${linhas.length + 1}`;
  partes.push(
    `</sheetData><autoFilter ref="A1:${ultima}"/></worksheet>`
  );
  void nomeAba;
  return partes.join("");
}

/**
 * Gera e baixa um arquivo .xlsx real.
 * @param nomeArquivo sem extensao (ex.: "relatorio-emissoes-2026-08-12")
 */
export function exportarExcel<T>(
  nomeArquivo: string,
  colunas: ColunaExcel<T>[],
  linhas: T[],
  nomeAba = "Dados"
) {
  const enc = new TextEncoder();
  const aba = (nomeAba || "Dados").replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Dados";

  const arquivos: Entrada[] = [
    {
      nome: "[Content_Types].xml",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          `</Types>`
      ),
    },
    {
      nome: "_rels/.rels",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`
      ),
    },
    {
      nome: "xl/workbook.xml",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${esc(aba)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
      ),
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      dados: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`
      ),
    },
    { nome: "xl/styles.xml", dados: enc.encode(STYLES_XML) },
    { nome: "xl/worksheets/sheet1.xml", dados: enc.encode(montarSheet(colunas, linhas, aba)) },
  ];

  const blob = zipar(arquivos);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
