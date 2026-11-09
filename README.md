# Craft Notes Unique, atelier criativo

App de gestão do ateliê (estoque, produtos, pedidos, financeiro e mais). Etapa 0: fundação.
O desenho completo está no documento de planejamento (seções 1 a 17).

## O que já tem

- App instalável (PWA) para o tablet e para a web, com a marca
- Tema claro, escuro e automático, com paleta da marca e cores livres
- Banco local no aparelho (funciona sem internet)
- Teste da caneta (S Pen), teste de envio de fontes TTF e OTF
- Backup manual (exportar e restaurar arquivo)
- Regras de negócio testadas (`src/dominio`): estoque, receita, preço, prazo e equilíbrio
- Login com GitHub, quando o Supabase estiver configurado

## Estrutura

```text
src/
  app/        telas e componentes (React)
    tema/     cores, modo claro e escuro, marca
    modulos/  uma pasta de tela por módulo
  dominio/    regras de negócio puras, com testes
  dados/      banco local, backup e nuvem
public/icons  ícones e logomarca
```

## Publicação no GitHub Pages

1. No repositório: Settings, Pages, Source: **GitHub Actions**.
2. Faça push na branch `main`. O fluxo `.github/workflows/publicar.yml` testa, constrói e publica.
3. O endereço fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
4. No tablet, abra o endereço no Chrome e use "Instalar app" ou "Adicionar à tela inicial".

## Supabase (login com GitHub e nuvem)

Em Settings, Secrets and variables, Actions, aba Variables, crie `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`. Sem elas o app funciona em modo local.

## Comandos

```text
npm install    instalar dependências
npm run dev    rodar em desenvolvimento
npm test       rodar os testes das regras de negócio
npm run build  gerar a versão final
```
