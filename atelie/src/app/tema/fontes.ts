// Carrega fontes do Google Fonts sob demanda (uma tag <link> por finalidade). Sem internet, valem as fontes de reserva.
export function carregarFontes(id: string, url: string): void {
  const tag = `fontes-${id}`;
  let el = document.getElementById(tag) as HTMLLinkElement | null;
  if (!url) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.id = tag;
    el.rel = 'stylesheet';
    document.head.appendChild(el);
  }
  if (el.href !== url) el.href = url;
}
