// Troca de camadas do visor de cada prancha.
document.querySelectorAll('[data-visor]').forEach(function (visor) {
  var botoes = visor.querySelectorAll('[data-alvo]');
  function mostrar(id) {
    botoes.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.alvo === id)); });
    visor.querySelectorAll('[data-camada]').forEach(function (el) { el.hidden = el.dataset.camada !== id; });
    visor.querySelectorAll('[data-texto]').forEach(function (el) { el.hidden = el.dataset.texto !== id; });
  }
  botoes.forEach(function (b) {
    b.addEventListener('click', function () { mostrar(b.dataset.alvo); });
  });
});
