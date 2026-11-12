import { useState, type ChangeEvent } from 'react';
import { baixarArquivo, exportarTudo, importarTudo } from '../../dados/backup.ts';

export function Backup() {
  const [msg, setMsg] = useState('');

  async function exportar() {
    const blob = await exportarTudo();
    const data = new Date().toISOString().slice(0, 10);
    baixarArquivo(blob, `craft-notes-backup-${data}.json`);
    setMsg('Backup gerado. Guarde o arquivo no Google Drive.');
  }

  async function importar(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      await importarTudo(arquivo);
      setMsg('Backup restaurado.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Não consegui ler esse arquivo.');
    }
  }

  return (
    <>
      <h1>Backup</h1>
      <p className="suave">Exporta todos os dados e arquivos em um único arquivo.</p>
      <div className="cartao">
        <div className="linha">
          <button className="btn primario" onClick={() => void exportar()}>Exportar backup</button>
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Restaurar backup
            <input type="file" accept="application/json,.json" onChange={(e) => void importar(e)} style={{ position: 'absolute', left: -9999 }} />
          </label>
        </div>
        {msg && <p role="status">{msg}</p>}
        <p className="suave">O backup automático para o Google Drive entra na próxima parte da etapa 0.</p>
      </div>
    </>
  );
}
