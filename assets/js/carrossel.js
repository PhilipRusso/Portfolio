/* Banner rotativo da página inicial: troca de projeto a cada alguns segundos.
   Pausa com o mouse ou o foco do teclado sobre o banner, com a aba escondida,
   pelo botão de pausa e para quem pede menos animação no sistema. */
(function () {
  'use strict';
  document.querySelectorAll('.carrossel').forEach(function (c) {
    var slides = c.querySelectorAll('.carrossel__slide');
    var legendas = c.querySelectorAll('.carrossel__legenda');
    var marcas = c.querySelectorAll('.carrossel__marca');
    var pausa = c.querySelector('.carrossel__pausa');
    var areaLegendas = c.querySelector('.carrossel__legendas');
    var n = slides.length;
    if (n < 2) return;

    var intervalo = parseInt(c.getAttribute('data-intervalo'), 10) || 6000;
    var atual = 0, pausado = false, sobre = false, foco = false, ultimo = Date.now();
    try { pausado = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    function marcar(lista, k) {
      lista.forEach(function (el, j) {
        var on = j === k;
        el.classList.toggle('ativo', on);
        if (on) { el.removeAttribute('tabindex'); el.removeAttribute('aria-hidden'); }
        else { el.setAttribute('tabindex', '-1'); el.setAttribute('aria-hidden', 'true'); }
      });
    }

    function mostrar(k) {
      atual = ((k % n) + n) % n;
      marcar(slides, atual);
      marcar(legendas, atual);
      marcas.forEach(function (m, j) { m.setAttribute('aria-current', j === atual ? 'true' : 'false'); });
      ultimo = Date.now();
    }

    function atualizarPausa() {
      c.classList.toggle('pausado', pausado);
      pausa.setAttribute('aria-label', pausado ? pausa.getAttribute('data-retomar') : pausa.getAttribute('data-pausar'));
      // com a troca automática ligada, o leitor de tela não anuncia cada troca
      areaLegendas.setAttribute('aria-live', pausado ? 'polite' : 'off');
    }

    c.querySelectorAll('[hidden]').forEach(function (el) { el.removeAttribute('hidden'); });
    c.querySelector('.carrossel__seta--ant').addEventListener('click', function () { mostrar(atual - 1); });
    c.querySelector('.carrossel__seta--prox').addEventListener('click', function () { mostrar(atual + 1); });
    marcas.forEach(function (m, j) { m.addEventListener('click', function () { mostrar(j); }); });
    pausa.addEventListener('click', function () { pausado = !pausado; ultimo = Date.now(); atualizarPausa(); });

    c.addEventListener('mouseenter', function () { sobre = true; });
    c.addEventListener('mouseleave', function () { sobre = false; ultimo = Date.now(); });
    c.addEventListener('focusin', function () { foco = true; });
    c.addEventListener('focusout', function (ev) {
      if (!ev.relatedTarget || !c.contains(ev.relatedTarget)) { foco = false; ultimo = Date.now(); }
    });
    c.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft') { mostrar(atual - 1); ev.preventDefault(); }
      else if (ev.key === 'ArrowRight') { mostrar(atual + 1); ev.preventDefault(); }
    });

    atualizarPausa();
    setInterval(function () {
      if (pausado || sobre || foco || document.hidden) { ultimo = Date.now(); return; }
      if (Date.now() - ultimo >= intervalo) mostrar(atual + 1);
    }, 250);
  });
})();
