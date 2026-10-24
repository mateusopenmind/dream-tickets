// ZIP mínimo, escrito à mão, só com o método "armazenado" (sem compressão).
//
// Por que não uma biblioteca: o único uso é juntar comprovantes PNG, que já são
// comprimidos — zipar de novo não economizaria quase nada. Uma dependência a mais
// custaria instalação, build e atualização para render zero.
//
// Formato: APPNOTE 6.3.3 do PKWARE, só as partes necessárias — cabeçalho local,
// diretório central e o fim do diretório. Sem Zip64: o limite é 4 GB por arquivo e
// 65.535 arquivos, folgado para dezenas de comprovantes de ~50 KB.

export interface ArquivoZip {
  nome: string;
  dados: Uint8Array;
}

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// O ZIP guarda data e hora no formato do MS-DOS: 16 bits para cada, segundos de 2 em 2.
function dataDos(d: Date) {
  const hora = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const dia = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { hora, dia };
}

export function montarZip(arquivos: ArquivoZip[], quando: Date = new Date()): Blob {
  const cod = new TextEncoder();
  const { hora, dia } = dataDos(quando);
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;

  for (const a of arquivos) {
    const nome = cod.encode(a.nome);
    const crc = crc32(a.dados);
    const tam = a.dados.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);   // assinatura do cabeçalho local
    local.setUint16(4, 20, true);           // versão necessária
    local.setUint16(6, 0x0800, true);       // nome do arquivo em UTF-8
    local.setUint16(8, 0, true);            // método 0 = armazenado
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, tam, true);
    local.setUint32(22, tam, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nome, a.dados);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);      // assinatura do diretório central
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, hora, true);
    cd.setUint16(14, dia, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, tam, true);
    cd.setUint32(24, tam, true);
    cd.setUint16(28, nome.length, true);
    cd.setUint16(30, 0, true);
    cd.setUint16(32, 0, true);
    cd.setUint16(34, 0, true);
    cd.setUint16(36, 0, true);
    cd.setUint32(38, 0, true);
    cd.setUint32(42, deslocamento, true);   // onde começa o cabeçalho local deste arquivo
    central.push(new Uint8Array(cd.buffer), nome);

    deslocamento += 30 + nome.length + tam;
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);       // fim do diretório central
  fim.setUint16(4, 0, true);
  fim.setUint16(6, 0, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, deslocamento, true);
  fim.setUint16(20, 0, true);

  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: "application/zip" });
}

// Evita dois arquivos com o mesmo nome dentro do ZIP (o Windows abre só o primeiro).
export function nomeUnico(nome: string, usados: Set<string>): string {
  if (!usados.has(nome)) { usados.add(nome); return nome; }
  const ponto = nome.lastIndexOf(".");
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  const ext = ponto > 0 ? nome.slice(ponto) : "";
  let n = 2;
  while (usados.has(`${base}-${n}${ext}`)) n++;
  const novo = `${base}-${n}${ext}`;
  usados.add(novo);
  return novo;
}
