# CURUPIRA — DESIGN.md

> Contrato visual do produto. Escrito no formato `DESIGN.md` (getdesign.md / VoltAgent):
> um arquivo de texto que um agente de IA lê **antes** de escrever qualquer UI, para não
> gerar interface genérica. Se você vai mexer no front-end, leia isto primeiro e siga os
> tokens — não invente cor, tamanho de fonte nem espaçamento novo.

**Produto:** CURUPIRA · **Empresa:** Abner Software
**Tema:** cyberpunk sóbrio — void preto, neon funcional, tipografia mono para dado.

---

## 1. Visual Theme

Terminal de extração de mídia. A moldura é cyberpunk; o conteúdo é literal e calmo.

O neon é **funcional, não decorativo**: ele marca foco, estado e a ação primária. Fora
disso, a tela é cinza-azulada escura. Um único elemento neon dominante por região — se
tudo brilha, nada comunica.

Profundidade **não** usa sombra. Em fundo `#08080C` uma drop shadow é invisível; a
hierarquia vem da escada de superfícies (`bg` → `surface` → `surface-2`) mais uma
hairline de 1px. Glow (`box-shadow` colorido) existe só como acento no painel ativo e no
botão primário, nunca para simular elevação.

---

## 2. Color Palette & Roles

Ratios calculados pela fórmula de luminância relativa da WCAG 2.x, contra `{colors.surface}`
salvo indicação.

```yaml
colors:
  # superfícies — a escada da profundidade
  bg:         "#08080C"   # fundo raiz
  surface:    "#12121A"   # painéis, cards da fila
  surface-2:  "#1B1B26"   # controles dentro de um card, trilho de progresso

  # texto
  ink:        "#E8E8F0"   # corpo · 16,41:1 sobre bg
  ink-muted:  "#A5A5BF"   # metadados, unidades · 7,75:1

  # acentos
  accent:     "#00F0FF"   # cyan — foco, ação primária, progresso · 13,23:1
  brand:      "#FF2E97"   # magenta — seleção de qualidade · 5,40:1
  brand-hi:   "#FF66B2"   # magenta claro, obrigatório sobre surface-2 · 6,33:1

  # estados
  success:    "#B4FF39"   # 15,35:1
  warning:    "#FBBF24"   # 11,16:1
  danger:     "#FF5C5C"   # 6,15:1

  # estrutura
  hairline:   "#63638F"   # bordas, ícones · 3,29:1 (piso de objeto gráfico)
  on-accent:  "#08080C"   # texto sobre neon sólido · 14,19:1
```

**Regras de cor**

- Texto sobre botão neon é `{colors.on-accent}`, **nunca branco** (branco sobre cyan dá ~1,2:1).
- `{colors.brand}` sobre `{colors.surface-2}` cai para 4,95:1 → use `{colors.brand-hi}`.
- Neon sobre neon é proibido: magenta sobre cyan fica em ~2,4:1 e vibra.
- Cor **nunca** comunica sozinha. Todo estado leva ícone + rótulo em texto.

---

## 3. Typography

```yaml
typography:
  family-ui:    "Inter"          # toda a interface
  family-mono:  "JetBrains Mono" # URLs, bytes, %, velocidade, nomes de arquivo
  display:  { size: "clamp(2rem, 1.4rem + 3vw, 3.5rem)",       weight: 800, tracking: "-0.02em" }
  xl:       { size: "clamp(1.5rem, 1.25rem + 1.2vw, 2.25rem)",  weight: 700 }
  lg:       { size: "clamp(1.125rem, 1.05rem + 0.4vw, 1.375rem)", weight: 600 }
  base:     { size: "clamp(1rem, 0.96rem + 0.2vw, 1.0625rem)",  weight: 400, leading: 1.6 }
  sm:       { size: "clamp(0.875rem, 0.85rem + 0.2vw, 0.9375rem)" }
  xs:       { size: "clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem)" }
  eyebrow:  { size: "{typography.sm}", weight: 600, tracking: "0.06em", transform: "uppercase" }
```

- Máximo **duas famílias**. A fonte display cyberpunk, se um dia entrar, fica restrita ao
  logotipo — nunca em rótulo, mensagem de erro ou nome de arquivo.
- Todo número que muda ao vivo (%, MB, MB/s) usa `family-mono` **com
  `font-variant-numeric: tabular-nums`**, senão o valor "dança" a cada tick.
- `input` tem `font-size: max(16px, …)`. Abaixo de 16px o iOS Safari dá zoom ao focar.
- `text-shadow` (glow) só em texto ≥ 24px. O borrão come a borda da letra e derruba o
  contraste real — em corpo de texto é proibido.

---

## 4. Spacing, Radius & Breakpoints

```yaml
spacing:  { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 24px, 6: 32px, 7: 48px, 8: 64px }  # grade 8pt
rounded:  { sm: 4px, lg: 8px, pill: 999px }
sizing:   { tap: 48px, tap-min: 44px, maxw: 1120px }

breakpoints:   # em `em`, para responder ao zoom do navegador; content-driven
  sm: "30em"   # 480 — input e botão viram linha; chips fazem wrap
  md: "40em"   # 640 — prévia vira thumbnail + texto lado a lado
  lg: "48em"   # 768 — seletores de formato e qualidade lado a lado
  xl: "90em"   # 1440 — tweakpoint: trava em maxw, não estica
```

Cards da fila usam `container-type: inline-size`, não media query: o mesmo card aparece em
larguras diferentes na mesma página, e a viewport é a medida errada ali.

---

## 5. Component Stylings

```yaml
components:
  input-url:
    background: "{colors.bg}"
    text: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.sm}"
    height: "{sizing.tap}"
    typography: "{typography.family-mono}"
    focus: "2px solid {colors.accent}, offset 0"
    invalid: "border {colors.danger} + aria-invalid + aria-describedby"

  button-primary:
    background: "{colors.accent}"
    text: "{colors.on-accent}"
    glow: "0 0 24px -8px {colors.accent}"
    height: "{sizing.tap}"
    typography: "{typography.eyebrow}"

  button-ghost:      { background: transparent, text: "{colors.accent}", border: "1px solid {colors.accent} 55%" }
  button-quiet:      { background: transparent, text: "{colors.ink-muted}", border: "1px solid {colors.hairline} 70%" }
  button-danger:     { background: transparent, text: "{colors.danger}",  border: "1px solid {colors.danger} 55%" }

  segmented-format:  # MP4 / MP3 — 2 opções, decisão instantânea (Lei de Hick)
    track: "{colors.surface-2}"
    option-height: "{sizing.tap-min}"
    selected: "background {colors.accent}, text {colors.on-accent}"
    implementation: "radiogroup nativo com <input type=radio> visualmente oculto + :has(input:checked)"

  chip-quality:      # 1080p / 720p / …
    background: "{colors.surface-2}"
    text: "{colors.ink-muted}"
    selected: "border {colors.brand}, text {colors.brand-hi}, background {colors.brand} 14%"
    height: "{sizing.tap-min}"

  card-queue-item:
    background: "{colors.surface}"
    border: "1px solid {colors.hairline} 45%"
    accent-edge: "3px na borda esquerda, cor = cor do estado"
    shadow: none

  progress-bar:
    track: "{colors.surface-2}"
    fill: "linear-gradient(90deg, {colors.accent}, {colors.brand})"
    height: 6px
    role: "progressbar com aria-valuenow/min/max e aria-label"
    indeterminate: "faixa deslizante quando não há percentual real (conversão)"

  badge-platform:    # YouTube, TikTok, Vimeo… ícone da marca + nome escrito
    background: "{colors.surface-2}"
    icon-color: "cor oficial da marca, só no ícone — nunca no texto"

  status-pill:       { typography: "{typography.eyebrow}", content: "ícone + rótulo, sempre os dois" }

  empty-state:
    background: "{colors.surface}"   # superfície própria: só a borda tracejada some no fundo
    border: "1px dashed {colors.hairline} 60%"
    content: "título + explicação + próximo passo"

  row-pending:       # linha da lista de espera
    background: "{colors.surface}"
    border: "1px solid {colors.hairline} 45%"
    structure: "a linha inteira é um <button> rotulado 'Ajustar…'; remover é um botão IRMÃO, nunca aninhado"
    thumb: "72px (56px abaixo de 30em)"
    badge: "'padrão' tracejado x 'ajustado' sólido em {colors.brand} — herança precisa de rótulo, não só de cor"
    gap-entre-alvos: "{spacing.2}; {spacing.3} abaixo de 30em, porque o vizinho é destrutivo e mora na borda do polegar"

  modal-item:        # ajuste individual — <dialog> NATIVO, nunca div com overlay
    implementation: "showModal(): foco preso, Esc, inert no resto da página vêm do navegador"
    width: "min(100% - {spacing.4} * 2, 34rem)"
    max-height: 88dvh
    scroll: "mora no .modal__body, não no .modal — é o que permite o botão de fechar ser sticky"
    close: "sticky top, 44px, sempre visível: no toque não existe Esc"
    dismiss: "clique no backdrop fecha (o ::backdrop nativo não faz isso sozinho)"
    body-lock: "body:has(dialog[open]) { overflow: hidden } — showModal() não trava o scroll no Safari iOS"
    thumb: "altura FIXA, não aspect-ratio — ver nota em globals.css"

  backdrop-3d:       # campo de partículas WebGL (three.js)
    role: "medidor ambiente da fila, não enfeite: velocidade e brilho sobem com os downloads ativos"
    colors: "lidas dos tokens em runtime via getComputedStyle — nenhuma cor nova entra pelo canvas"
    coverage: "volume dimensionado pelo frustum da câmera + deriva com wrap; corpo que gira deixa canto vazio"
    z-index: "-1 (o body::before, estático, fica em -2 e é o fallback)"
    degradação: "prefers-reduced-motion = 1 quadro sem loop · sem WebGL = não monta · aba oculta = pausa"
```

---

## 6. Do's and Don'ts

**Do**

- Elevação por escada de superfície + hairline de 1px.
- Neon reservado a foco, ação primária e estado.
- Números ao vivo em mono tabular.
- Todo estado com ícone **e** palavra.
- Alvos de toque de 48px (piso absoluto 44px), 8px de folga entre eles.
- `:focus-visible` com anel cyan de 2px e `outline-offset: 2px` em tudo que recebe foco.
- Título de vídeo com `overflow-wrap: anywhere` e clamp de 2 linhas.

**Don't**

- Nunca `outline: none` sem substituto. O anel cyan combina com a estética — é o item mais
  barato de acertar.
- Nunca drop shadow em card.
- Nunca glitch, flicker ou scanline permanente: é risco fotossensível (WCAG 2.3.1) e mata a
  percepção de progresso. Efeito pontual (&lt; 400ms), e desligado em `prefers-reduced-motion`.
- Nunca jargão de terminal como microcopy (`> INITIALIZING PAYLOAD...`). A moldura é
  cyberpunk; o texto é português claro e literal.
- Nunca botão primário desabilitado e cinza como forma de bloquear: mantenha ativo e explique.
- Nunca `aria-live` na barra de progresso — a cada 1% o leitor de tela vira metralhadora.
  Use uma região `polite` separada, anunciando só marcos (25/50/75%) e transições de estado.

---

## 7. Responsive Behavior

- **Mobile-first.** O padrão é uma coluna; cada breakpoint só entra onde o layout de fato quebra.
- **Input de URL**: largura total, com `type=url` + `inputmode=url` + `autocomplete=url` +
  `spellcheck=false` + `autocapitalize=off`. Label visível acima — placeholder é exemplo, não
  instrução. Botão "Colar" ao lado, porque digitar URL longa no celular é sofrível.
- **Botão "Adicionar"**: ocupa a faixa inteira abaixo do campo no mobile (grade de 2 colunas,
  com o "Colar" só-ícone ao lado do input), inline a partir de `30em`.
- **Card da fila**: thumbnail 88px + texto em duas linhas; barra de progresso em largura
  total abaixo; ações numa linha própria com alvos de 40px+.
- **Chips de qualidade**: fazem wrap, nunca scroll horizontal escondido.
- Nada de gesto invisível: cancelar e remover são botões visíveis, não swipe.
- A página **nunca** rola horizontalmente. Conteúdo largo rola dentro do próprio container.
  Todo `.btn` tem `max-width: 100%`; rótulo composto que não cabe usa `.btn--wrap`, porque
  `white-space: nowrap` sem teto empurra o container e cria rolagem na página inteira.
- **Tipografia não encolhe no celular** — a moldura encolhe. O piso é 16px no corpo
  (`max(16px, …)` no input evita o auto-zoom do iOS) e 13px só em nota de rodapé; dado ao
  vivo (percentual, bytes, velocidade, ETA) fica em `{typography.sm}`.
- **Hover só onde há ponteiro**: todo `:hover` vive em `@media (hover: hover) and
  (pointer: fine)`. No iOS a pseudo-classe dispara no primeiro toque e **fica grudada**,
  anunciando um estado que já passou. O retorno ao toque é `:active` com `scale(0.985)`.
- **Safe area**: `viewportFit: "cover"` e os `env(safe-area-inset-*)` no `.shell` são um
  pacote fechado — um sem o outro come conteúdo no recorte da tela.
- **Teclado virtual**: `interactiveWidget: "resizes-content"`, `enterKeyHint="go"` no campo,
  e a mensagem de erro é rolada à vista quando aparece, senão nasce atrás do teclado.

---

## 8. Agent Prompt Guide

Ao pedir UI nova para um agente, cole junto:

> Leia `DESIGN.md` antes de escrever qualquer UI. Use apenas os tokens definidos lá
> (`{colors.*}`, `{typography.*}`, `{spacing.*}`) via as CSS custom properties já
> declaradas em `src/app/globals.css` — não introduza cor, tamanho ou espaçamento novo.
> Mobile-first. Todo estado com ícone e rótulo. Foco visível obrigatório. Microcopy em
> pt-BR, literal, sem jargão de terminal.

Os tokens deste arquivo têm correspondência 1:1 com as custom properties em
`src/app/globals.css` (`--bg`, `--surface`, `--accent`, `--sp-4`, `--fs-lg`…). Ao alterar
um, altere o outro.
