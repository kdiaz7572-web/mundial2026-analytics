// ============================================================
//  BRACKET VIEW — Mundial 2026 (render visual de "llaves")
//  Expone window.renderBracketView(bracketData) → string HTML.
//  Consume la estructura de computeBracket() (bracket_engine.js).
//  Estilos estructurales viven en index.html bajo .bracket-wrap.
//  Solo Tailwind utilities inline + paleta de la app.
// ============================================================

(function () {
  'use strict';

  // Bandera real (flagcdn). Copia local para no depender de carga de app.js.
  function flagImg(iso2, cls) {
    if (!iso2) return '';
    return '<img src="https://flagcdn.com/h20/' + iso2 + '.png" srcset="https://flagcdn.com/h40/' + iso2 + '.png 2x" width="20" loading="lazy" alt="" class="' + (cls || '') + '" style="display:inline-block;border-radius:2px;vertical-align:middle;box-shadow:0 0 1px rgba(0,0,0,.4)">';
  }

  // Escapa texto para usar en HTML / atributos.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Una fila (home o away) dentro de la card de un partido.
  function renderSlot(slot) {
    if (!slot || typeof slot !== 'object') {
      slot = { name: '—', flag: '⬜', placeholder: true };
    }
    const isPh = !!slot.placeholder || !slot.short;
    const flag = esc(slot.flag || '⬜');
    const name = esc(slot.name || '');

    if (isPh) {
      // Slot sin definir: dashed / muteado.
      return `
        <div class="bv-slot bv-slot-ph" title="${name}">
          <span class="bv-flag">${flag}</span>
          <span class="bv-ph-text">${name}</span>
        </div>`;
    }

    const short = esc(slot.short);
    // Slot real: usar bandera flagcdn vía iso2 del equipo global; emoji como fallback.
    const iso2 = (typeof getTeam === 'function' && getTeam(slot.short)) ? getTeam(slot.short).iso2 : null;
    const flagHtml = iso2 ? flagImg(iso2) : flag;
    return `
      <div class="bv-slot" title="${name}">
        <span class="bv-flag">${flagHtml}</span>
        <span class="bv-short">${short}</span>
        <span class="bv-name">${name}</span>
      </div>`;
  }

  // Card de un partido: dos filas (home / away).
  // variant: 'final' resalta en ámbar, 'third' para 3er puesto.
  function renderMatch(match, variant) {
    if (!match) return '';
    const cls =
      variant === 'final'
        ? 'bv-card bv-card-final'
        : variant === 'third'
        ? 'bv-card bv-card-third'
        : 'bv-card';
    return `
      <div class="${cls}" data-id="${esc(match.id || '')}">
        ${renderSlot(match.home)}
        <div class="bv-divider"></div>
        ${renderSlot(match.away)}
      </div>`;
  }

  // Una columna = una ronda con su header y stack de cards.
  function renderRound(round, isFinal) {
    if (!round || !Array.isArray(round.matches)) return '';
    const variant = isFinal ? 'final' : null;
    const cards = round.matches.map((m) => renderMatch(m, variant)).join('');
    const headCls = isFinal ? 'bv-col-head bv-col-head-final' : 'bv-col-head';
    return `
      <div class="bv-col bv-col-${esc(round.key || '')}">
        <div class="${headCls}">${esc(round.label || '')}</div>
        <div class="bv-col-body">${cards}</div>
      </div>`;
  }

  // Chips de "Mejores terceros".
  function renderBestThirds(list) {
    if (!Array.isArray(list) || list.length === 0) return '';
    const chips = list
      .map((t) => {
        if (!t) return '';
        const iso2 = (typeof getTeam === 'function' && getTeam(t.short)) ? getTeam(t.short).iso2 : null;
        const flagHtml = iso2 ? flagImg(iso2) : esc(t.flag || '⬜');
        return `<span class="bv-chip" title="${esc(t.name || '')}">
            <span class="bv-flag">${flagHtml}</span>
            <span class="bv-chip-short">${esc(t.short || '?')}</span>
          </span>`;
      })
      .join('');
    return `
      <div class="bv-thirds">
        <span class="bv-thirds-label">Mejores terceros</span>
        <div class="bv-thirds-chips">${chips}</div>
      </div>`;
  }

  // Estado vacío amigable.
  function emptyState(msg) {
    return `
      <div class="bracket-wrap">
        <div class="bv-empty">
          <span class="bv-empty-icon">🏆</span>
          <p class="bv-empty-title">Eliminatorias no disponibles</p>
          <p class="bv-empty-msg">${esc(msg || 'Aún no hay datos de llaves para mostrar.')}</p>
        </div>
      </div>`;
  }

  function renderBracketView(b) {
    if (!b || !Array.isArray(b.rounds) || b.rounds.length === 0) {
      return emptyState('Completa la fase de grupos para generar el cuadro.');
    }

    const lastIdx = b.rounds.length - 1;
    const cols = b.rounds
      .map((r, i) => renderRound(r, i === lastIdx))
      .join('');

    // Banner provisional cuando no está lista la fase de grupos.
    let banner = '';
    if (b.ready === false) {
      banner = `
        <div class="bv-banner">
          <span class="bv-banner-icon">ℹ️</span>
          <div class="bv-banner-text">
            <span class="bv-banner-strong">Sembrado provisional según posiciones actuales.</span>
            ${b.note ? `<span class="bv-banner-note">${esc(b.note)}</span>` : ''}
          </div>
        </div>`;
    }

    const thirds = renderBestThirds(b.bestThirds);

    // Bloque del 3er puesto (junto a la Final en desktop, debajo en móvil).
    const thirdBlock = b.thirdPlace
      ? `
        <div class="bv-third-block">
          <div class="bv-col-head bv-col-head-third">3er Puesto</div>
          ${renderMatch(b.thirdPlace, 'third')}
        </div>`
      : '';

    return `
      <div class="bracket-wrap">
        <div class="bv-header">
          <h2 class="bv-title">🏆 Eliminatorias — Mundial 2026</h2>
          ${thirds}
        </div>
        ${banner}
        <div class="bv-scroll">
          <div class="bv-tree">
            ${cols}
          </div>
          ${thirdBlock}
        </div>
      </div>`;
  }

  window.renderBracketView = renderBracketView;
})();
