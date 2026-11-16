import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { baixarArquivo, exportarTudo, importarTudo } from '../../dados/backup.ts';
import { nuvem } from '../../dados/nuvem.ts';
import { baixarCopia, fazerBackupNaNuvem, guardarFrequencia, lerConfiguracao, listarCopias, restaurarCopia, type CopiaNaNuvem } from '../../dados/backupNuvem.ts';
import { COPIAS_GUARDADAS, FREQUENCIAS, tamanhoLegivel } from '../../dominio/backupNuvem.ts';

const quando = (d: Date) => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function BackupNaNuvem() {
  const [copias, setCopias] = useState<CopiaNaNuvem[]>([]);
  const [dias, setDias] = useState(7);
  const [ultimo, setUltimo] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    const c = await lerConfiguracao();
    setDias(c.dias);
    setUltimo(c.ultimo);
    try {
      setCopias(await listarCopias());
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ver as cópias.');
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function agora() {
    setOcupado(true);
    setMsg('');
    setErro('');
    try {
      await fazerBackupNaNuvem();
      setMsg('Backup feito na nuvem.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui fazer o backup.');
    } finally {
      setOcupado(false);
    }
  }

  async function restaurar(nome: string) {
    setOcupado(true);
    setMsg('');
    setErro('');
    setConfirmar(null);
    try {
      await restaurarCopia(nome);
      setMsg('Cópia restaurada. O que foi criado depois dela foi mantido. Os outros aparelhos recebem na próxima sincronização.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui restaurar essa cópia.');
    } finally {
      setOcupado(false);
    }
  }

  async function baixar(c: CopiaNaNuvem) {
    try {
      baixarArquivo(await baixarCopia(c.nome), `craft-notes-${c.nome}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui baixar.');
    }
  }

  return (
    <section className="cartao">
      <h2>Backup automático na nuvem</h2>
      <p className="suave" style={{ marginTop: 0 }}>
        O app guarda sozinho uma cópia completa dos seus dados (com fotos) no Supabase, enquanto você usa. Ficam as {COPIAS_GUARDADAS} cópias mais recentes.
      </p>
      <div className="linha" style={{ alignItems: 'flex-end' }}>
        <label className="escolha-rotulo" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Com que frequência
          <select value={dias} onChange={(e) => { const d = Number(e.target.value); setDias(d); void guardarFrequencia(d); }}>
            {FREQUENCIAS.map((f) => <option key={f.dias} value={f.dias}>{f.nome}</option>)}
          </select>
        </label>
        <button className="btn primario" disabled={ocupado} onClick={() => void agora()}>{ocupado ? 'Aguarde…' : 'Fazer backup agora'}</button>
      </div>
      <p className="suave" style={{ margin: '8px 0 0' }}>
        {ultimo ? `Último backup feito por este aparelho: ${quando(new Date(ultimo))}.` : 'Este aparelho ainda não fez nenhum backup.'}
      </p>
      {msg && <p role="status" style={{ marginBottom: 0 }}>{msg}</p>}
      {erro && <p className="aviso" role="alert">{erro}</p>}

      <h3 style={{ margin: '16px 0 6px' }}>Cópias guardadas</h3>
      {copias.length === 0 && !erro && <p className="suave" style={{ margin: 0 }}>Ainda não há cópias na nuvem.</p>}
      <ul className="painel-lista">
        {copias.map((c) => (
          <li key={c.nome} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <span style={{ flex: 1, minWidth: 180 }}>
              <strong>{quando(c.data)}</strong> <span className="suave">· {c.tamanho ? tamanhoLegivel(c.tamanho) : ''}</span>
            </span>
            <button className="btn pequeno" disabled={ocupado} onClick={() => void baixar(c)}>Baixar</button>
            {confirmar === c.nome ? (
              <>
                <button className="btn pequeno primario" disabled={ocupado} onClick={() => void restaurar(c.nome)}>Confirmar restauração</button>
                <button className="btn pequeno" onClick={() => setConfirmar(null)}>Cancelar</button>
              </>
            ) : (
              <button className="btn pequeno" disabled={ocupado} onClick={() => setConfirmar(c.nome)}>Restaurar</button>
            )}
          </li>
        ))}
      </ul>
      {confirmar && <p className="suave" style={{ fontSize: 13 }}>Restaurar traz de volta os cadastros como estavam nessa cópia. O que você criou depois dela continua no app; o que foi alterado depois volta ao que estava na cópia.</p>}
    </section>
  );
}

export function Backup() {
  const [msg, setMsg] = useState('');

  async function exportar() {
    const blob = await exportarTudo();
    const data = new Date().toISOString().slice(0, 10);
    baixarArquivo(blob, `craft-notes-backup-${data}.json`);
    setMsg('Backup gerado. Guarde o arquivo em um lugar seguro, como o Google Drive.');
  }

  async function importar(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      await importarTudo(arquivo, { prevalecer: true });
      setMsg('Backup restaurado. O que estava no arquivo passa a valer, inclusive nos outros aparelhos, na próxima sincronização. O que foi criado depois dele foi mantido.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Não consegui ler esse arquivo.');
    }
  }

  return (
    <>
      <h1>Backup</h1>
      <p className="suave">Cópias de segurança dos seus dados e arquivos.</p>
      {nuvem && <BackupNaNuvem />}
      <div className="cartao">
        <h2>Backup em arquivo</h2>
        <div className="linha">
          <button className="btn primario" onClick={() => void exportar()}>Exportar backup</button>
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Restaurar de um arquivo
            <input type="file" accept="application/json,.json" onChange={(e) => void importar(e)} style={{ position: 'absolute', left: -9999 }} />
          </label>
        </div>
        {msg && <p role="status">{msg}</p>}
        <p className="suave">Guarda tudo em um único arquivo no seu aparelho, para você levar para onde quiser.</p>
      </div>
    </>
  );
}
