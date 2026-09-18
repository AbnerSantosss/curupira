# Auditoria de UX e responsividade — 2026-08-02

Auditoria do MVP do [[CURUPIRA]] (à época chamado DATAJACK) executada em navegador real
(Playwright) contra
`http://localhost:3000`, em cinco viewports: 360×800, 390×844, 768×1024, 1280×800 e
1920×1080. Todos os números abaixo foram **medidos**, não estimados.

## Resultado geral

| Verificação | Resultado |
|---|---|
| Scroll horizontal | **Nenhum** em nenhum viewport (`scrollWidth === clientWidth` nos 5) |
| Erros/warnings de console | **0** |
| Contraste WCAG AA | Todos os pares aprovados (ver tabela abaixo) |
| Hierarquia de headings | H1 → H2 → H3 sem pulos, um único H1 |
| Foco de teclado | Visível em todos os controles, sem `outline: none` órfão |
| Rótulos de formulário | `<label for>` real no campo de URL; radios envolvidos por `<label>` |
| Idioma | `lang="pt-BR"` |

Contrastes medidos: H1 16,41:1 · texto secundário 8,32:1 · chips 7,09:1 ·
botão primário 14,19:1 · estado "pronto" 15,35:1 · placeholder 4,50:1.

## Achados e providências

### 1. Alvos de toque abaixo do mínimo — corrigido

`.btn--sm` ("Salvar arquivo", "Tirar da lista") media **40px** de altura; o piso da
WCAG 2.5.5 é 44px. Eram os únicos controles abaixo do limite — todo o resto media 44 ou 48.

**Correção:** `min-height: 44px` em `.btn--sm` e `min-width: 44px` em `.btn--icon.btn--sm`.
O "pequeno" da variante passou a ser o padding horizontal e a tipografia, nunca a altura
clicável.

### 2. Tipografia de 12,1px em metadados e rótulos — corrigido

`--fs-xs` tinha piso de `0.75rem`, resultando em **12,1px** medidos em `.item__stats`,
`.item__tags`, `.tag`, `.source` e no rótulo dos botões de ação. O contraste passava, mas
o tamanho é desconfortável no celular.

**Correção:** piso do clamp elevado para `0.8125rem` (13px), teto `0.875rem` (14px).

### 3. Formato não resetava ao descartar — corrigido

Após clicar "Descartar" e analisar outro link, a escolha anterior (ex.: Áudio MP3)
permanecia selecionada.

**Correção:** "Descartar" agora limpa formato, qualidade e erro. Enfileirar com sucesso
**mantém** o formato de propósito, porque o uso típico é mandar vários links seguidos no
mesmo formato.

### 4. Link inline do rodapé com 15,2px de altura — corrigido

Formalmente isento (WCAG 2.5.8 dispensa links inline dentro de bloco de texto), mas
apertado ao toque.

**Correção:** `display: inline-block` com `padding-block` no `.footer a`.

### 5. Espessura do anel de foco — não reproduzido como defeito

A auditoria mediu `outline: 1.6px` onde o CSS declara `2px`, junto com `outline-offset`
igualmente escalado por 0,8. Os dois valores escalados na mesma proporção apontam para
fator de escala do ambiente de medição, não para sobrescrita de CSS. O foco está
**claramente visível** na captura de tela correspondente. Nenhuma alteração feita;
registrado para reverificação futura.

### 6. Mojibake em título de job — falso positivo

Um card exibia `Chega de Saudade � Jo�o Gilberto`. Investigado: a corrupção estava no
**payload do teste via curl**, cujo shell não enviou UTF-8, e não na aplicação. Confirmado
com um teste mais duro, enviando corpo JSON UTF-8 explícito com acentos, cedilha, til,
trema e CJK — o servidor recebeu e exibiu `Ação — João Gilberto Ñ ü 日本` intacto.

Vale notar que existiu um bug real de encoding neste projeto, já corrigido antes desta
auditoria: o yt-dlp escreve no stdout com a codepage do console no Windows, e o Node lia
como UTF-8. Ver `PYTHONIOENCODING` em `src/lib/ytdlp.ts` e a seção de decisões do README.

## Revalidação após as correções

Segunda passada no navegador, com a fila populada, confirmando que os três itens corrigidos
foram de fato resolvidos e que nada regrediu:

| Item | Antes | Depois |
|---|---|---|
| `.btn--sm` (Salvar arquivo / Tirar da lista) | 40px | **44px** |
| `.item__stats`, `.item__tags`, `.tag`, `.source`, `.btn--sm` | 12,1px | **13,1px** |
| Formato após "Descartar" | mantinha MP3 | **volta a "Vídeo MP4"** |
| `.footer a` | 15,2px | 28,98px (decisão consciente, ver item 4) |
| Scroll horizontal (5 viewports) | nenhum | **nenhum** |
| Erros/warnings de console | 0 | **0** |

Todos os demais controles medem 44 ou 48px: campo de URL 48, Colar 48, Analisar 48,
segmented 44, chips 44, Baixar 48, Descartar 48.

## Capturas

Em [`auditoria/`](./auditoria/): `01`–`05` são a página completa nos cinco viewports;
`06` é o foco de teclado; `07`–`11` a prévia com seletor de formato e qualidade em 360, 390
e 1280; `12` e `13` são o estado pós-correção com a fila populada.
