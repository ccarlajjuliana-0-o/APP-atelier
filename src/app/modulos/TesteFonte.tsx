import { useEffect, useState, type ChangeEvent } from 'react';
import { db, novoId, type FonteRegistro } from '../../dados/db.ts';

// Teste de envio de fontes TTF e OTF: guarda o arquivo no aparelho e mostra uma prévia.
// (.odt é formato de documento de texto, não de fonte, e não é aceito.)

async function registrarFonte(f: FonteRegistro): Promise<void> {
  const url = URL.createObjectURL(f.arquivo);
  const face = new FontFace(`atelie-${f.id}`, `url(${url})`);
  await face.load();
  document.fonts.add(face);
}

export function TesteFonte() {
  const [fontes, setFontes] = useState<FonteRegistro[]>([]);
  const [erro, setErro] = useState('');

  async function recarregar() {
    const lista = await db.fontes.toArray();
    for (const f of lista) {
      try {
        await registrarFonte(f);
      } catch {
        /* fonte inválida: aparece sem prévia */
      }
    }
    setFontes(lista);
  }

  useEffect(() => {
    void recarregar();
  }, []);

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    setErro('');
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    const nome = arquivo.name.toLowerCase();
    const formato = nome.endsWith('.ttf') ? 'ttf' : nome.endsWith('.otf') ? 'otf' : null;
    if (!formato) {
      setErro('Use um arquivo de fonte .ttf ou .otf. (Arquivos .odt são documentos de texto, não fontes.)');
      return;
    }
    const registro: FonteRegistro = {
      id: novoId(),
      nome: arquivo.name.replace(/\.(ttf|otf)$/i, ''),
      formato,
      licenca: 'a confirmar',
      ativa: true,
      arquivo,
      criadoEm: new Date().toISOString(),
    };
    try {
      await registrarFonte(registro);
    } catch {
      setErro('Não consegui ler essa fonte. Tente outro arquivo.');
      return;
    }
    await db.fontes.add(registro);
    await recarregar();
  }

  async function alternar(f: FonteRegistro) {
    await db.fontes.update(f.id, { ativa: !f.ativa });
    await recarregar();
  }

  async function remover(f: FonteRegistro) {
    await db.fontes.delete(f.id);
    await recarregar();
  }

  return (
    <>
      <h1>Teste de fontes</h1>
      <p className="suave">Envie fontes .ttf ou .otf para usar nos projetos.</p>
      <div className="cartao">
        <label className="btn primario" style={{ display: 'inline-flex', alignItems: 'center' }}>
          Enviar fonte
          <input type="file" accept=".ttf,.otf" onChange={(e) => void aoEscolher(e)} style={{ position: 'absolute', left: -9999 }} />
        </label>
        {erro && <p className="aviso" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
      </div>
      {fontes.map((f) => (
        <div key={f.id} className="cartao" style={{ opacity: f.ativa ? 1 : 0.55 }}>
          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <strong>{f.nome}</strong>
            <span className="etiqueta">.{f.formato} · licença: {f.licenca}</span>
          </div>
          <div style={{ fontFamily: `atelie-${f.id}, cursive`, fontSize: 40, margin: '10px 0' }}>Craft Notes Unique</div>
          <div className="linha">
            <button className="btn" onClick={() => void alternar(f)}>{f.ativa ? 'Desativar' : 'Ativar'}</button>
            <button className="btn" onClick={() => void remover(f)}>Remover</button>
          </div>
        </div>
      ))}
    </>
  );
}
