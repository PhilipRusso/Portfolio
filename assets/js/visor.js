// Visor das pranchas: troca de camadas (por botão ou por facetas), coordenadas sob o cursor, escala, rosa dos ventos
// e rótulos das áreas. Os mapas georreferenciados trazem data-geo = "lon mín, lon máx, lat mín, lat máx[, x0, y0, x1, y1]",
// em WGS 84 (EPSG:4326); os quatro últimos valores, quando existem, limitam a área do mapa dentro da imagem (frações).
(function () {
  var ESCALAS = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  var ROSA = '<svg class="rosa" viewBox="0 0 100 124" role="img"><text x="50" y="15" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="17" font-weight="500" fill="#1A1A1A" stroke="#FFFFFF" stroke-width="3" paint-order="stroke">N</text>' +
    '<g transform="translate(50 72)" stroke="#1A1A1A" stroke-width="1.2" stroke-linejoin="round"><circle r="23" fill="none" stroke-width="1"/>' +
    '<g transform="rotate(45)"><path d="M0 -30 L4 -4 L0 0 Z" fill="#1A1A1A"/><path d="M0 -30 L-4 -4 L0 0 Z" fill="#FFFFFF"/><path d="M0 30 L-4 4 L0 0 Z" fill="#1A1A1A"/><path d="M0 30 L4 4 L0 0 Z" fill="#FFFFFF"/><path d="M30 0 L4 4 L0 0 Z" fill="#1A1A1A"/><path d="M30 0 L4 -4 L0 0 Z" fill="#FFFFFF"/><path d="M-30 0 L-4 -4 L0 0 Z" fill="#1A1A1A"/><path d="M-30 0 L-4 4 L0 0 Z" fill="#FFFFFF"/></g>' +
    '<path d="M0 -50 L7 -7 L0 0 Z" fill="#1A1A1A"/><path d="M0 -50 L-7 -7 L0 0 Z" fill="#FFFFFF"/><path d="M0 50 L-7 7 L0 0 Z" fill="#1A1A1A"/><path d="M0 50 L7 7 L0 0 Z" fill="#FFFFFF"/>' +
    '<path d="M44 0 L7 7 L0 0 Z" fill="#1A1A1A"/><path d="M44 0 L7 -7 L0 0 Z" fill="#FFFFFF"/><path d="M-44 0 L-7 -7 L0 0 Z" fill="#1A1A1A"/><path d="M-44 0 L-7 7 L0 0 Z" fill="#FFFFFF"/></g></svg>';

  // comprimento de 1° de longitude, em km, no elipsoide WGS 84
  function kmPorGrau(lat) {
    var p = lat * Math.PI / 180, s = Math.sin(p);
    return Math.PI / 180 * 6378.137 * Math.cos(p) / Math.sqrt(1 - 0.00669438 * s * s);
  }
  function lerGeo(el) {
    var g = el.dataset.geo.split(',').map(Number);
    return { x0: g[0], x1: g[1], y0: g[2], y1: g[3], bx0: g.length > 4 ? g[4] : 0, by0: g.length > 5 ? g[5] : 0, bx1: g.length > 6 ? g[6] : 1, by1: g.length > 7 ? g[7] : 1 };
  }

  document.querySelectorAll('[data-visor]').forEach(function (visor) {
    var ui = JSON.parse(visor.dataset.ui);
    var hem = ui.hem.split(' ');
    var milhar = document.documentElement.lang === 'en' ? ',' : '.';
    var est = { coord: false, escala: false, rosa: false, num: false, nome: false, menu: false, ponto: null, lab: null };
    var ferr = visor.querySelector('[data-ferramentas]');
    var areas = visor.querySelector('[data-areas]');
    var leitura = visor.querySelector('[data-leitura]');
    var menu = ferr.querySelector('[data-menu]');
    var painel = ferr.querySelector('.ferramentas__painel');
    var conta = ferr.querySelector('.ferramentas__conta');
    var botoes = visor.querySelectorAll('[data-alvo]');
    var facetas = visor.querySelectorAll('[data-faceta]');
    var fac = visor.dataset.facetas ? JSON.parse(visor.dataset.facetas) : null;
    var atual = visor.querySelector('[data-camada]:not([hidden])') || visor.querySelector('[data-camada]');

    function graus(v, pos, neg) {
      var h = v >= 0 ? pos : neg, a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60);
      if (m === 60) { m = 0; d += 1; }
      return d + '°' + String(m).padStart(2, '0') + '′ ' + h;
    }
    function km(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, milhar); }

    function mira(m) {
      var p = est.ponto, on = est.coord && p && p.el === m;
      if (!m._mira) {
        m._mira = ['mira mira--v', 'mira mira--h'].map(function (c) {
          var d = document.createElement('div'); d.className = c; d.setAttribute('aria-hidden', 'true'); m.appendChild(d); return d;
        });
      }
      m._mira[0].hidden = m._mira[1].hidden = !on;
      if (!on) return;
      var g = lerGeo(m);
      m._mira[0].style.cssText = 'left:' + p.fx * 100 + '%;top:' + g.by0 * 100 + '%;height:' + (g.by1 - g.by0) * 100 + '%';
      m._mira[1].style.cssText = 'top:' + p.fy * 100 + '%;left:' + g.bx0 * 100 + '%;width:' + (g.bx1 - g.bx0) * 100 + '%';
    }

    // escala e rosa dos ventos: só no último mapa da camada (um conjunto por painel)
    function canto(m) {
      var mostra = m.hasAttribute('data-ultimo') && m.dataset.dir !== undefined && (est.escala || est.rosa);
      if (!m._canto) {
        if (!mostra) return;
        var c = document.createElement('div');
        c.className = 'canto';
        c.innerHTML = '<div class="escala" role="img"><div class="escala__rot" aria-hidden="true"><span class="escala__zero">0</span><span class="escala__valor"></span></div>' +
          '<div class="escala__barra" aria-hidden="true"><span></span></div><div class="escala__nota" aria-hidden="true"><span></span></div></div>' + ROSA;
        c.querySelector('.rosa').setAttribute('aria-label', ui.rosa);
        m.appendChild(c); m._canto = c;
      }
      var d = m._canto;
      d.hidden = !mostra;
      if (!mostra) return;
      var esq = m.dataset.canto === 'l';
      d.style.left = esq ? m.dataset.dir + '%' : 'auto';
      d.style.right = esq ? 'auto' : m.dataset.dir + '%';
      d.style.bottom = m.dataset.base + 'px';
      var esc = d.querySelector('.escala'), rosa = d.querySelector('.rosa');
      esc.hidden = !est.escala;
      rosa.style.display = est.rosa ? '' : 'none';
      rosa.style.width = m.dataset.rosa + 'cqw';
      if (!est.escala) return;
      // medida na latitude do cursor; sem cursor, no equador (ou no centro, se o mapa não o contém)
      var g = lerGeo(m), lat0 = g.y0 <= 0 && g.y1 >= 0 ? 0 : (g.y0 + g.y1) / 2;
      var lat = est.ponto ? est.ponto.lat : lat0, k = kmPorGrau(lat);
      var alvo = Math.min(0.16 * Number(atual.dataset.cols || 1), 0.42) * (g.x1 - g.x0) * k, v = ESCALAS[0];
      ESCALAS.forEach(function (e) { if (e <= alvo) v = e; });
      esc.style.width = (v / k / (g.x1 - g.x0) * (g.bx1 - g.bx0) * 100).toFixed(3) + 'cqw';
      var la = Math.round(Math.abs(lat)), onde = la === 0 ? ui.equador : ui.em + ' ' + la + '° ' + (lat > 0 ? hem[0] : hem[1]);
      esc.querySelector('.escala__valor').textContent = km(v) + ' km';
      esc.querySelector('.escala__nota span').textContent = ui.escala + ' ' + onde;
      esc.setAttribute('aria-label', ui.escala + ': ' + km(v) + ' km ' + onde);
    }

    function rotulos(m) {
      var r = m.querySelector('[data-rotulos]');
      if (!r) return;
      r.hidden = !est.num;
      r.querySelectorAll('.rotulo').forEach(function (b) {
        var aberto = est.nome && est.lab === b;
        b.querySelector('.rotulo__nome').hidden = !aberto;
        b.classList.toggle('rotulo--aberto', aberto);
        b.classList.toggle('rotulo--ativo', est.nome);
        b.setAttribute('aria-expanded', String(aberto));
      });
    }

    function desenhar() {
      var temGeo = atual.hasAttribute('data-geo-camada');
      painel.hidden = !est.menu;
      menu.setAttribute('aria-expanded', String(est.menu));
      ferr.classList.toggle('ferramentas--aberto', est.menu);
      var n = [est.coord, est.escala, est.rosa].filter(Boolean).length;
      conta.hidden = !n; conta.textContent = n;
      menu.classList.toggle('ativo', est.menu || n > 0);
      painel.querySelectorAll('[data-chave]').forEach(function (b) { b.setAttribute('aria-checked', String(!!est[b.dataset.chave])); });
      areas.querySelectorAll('[data-areas-btn]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!est[b.dataset.areasBtn])); });
      leitura.hidden = !(est.coord && temGeo);
      leitura.querySelector('.leitura__coord').textContent = est.ponto ? graus(est.ponto.lat, hem[0], hem[1]) + '   ' + graus(est.ponto.lon, hem[2], hem[3]) : ui.passe;
      atual.querySelectorAll('[data-geo]').forEach(function (m) {
        m.style.cursor = est.coord || est.escala ? 'crosshair' : '';
        mira(m); canto(m); rotulos(m);
      });
    }

    // os controles vão para a moldura da camada visível
    function montar() {
      var fig = atual.querySelector('.visor__quadro');
      fig.appendChild(ferr); fig.appendChild(areas); fig.appendChild(leitura);
      ferr.hidden = !atual.hasAttribute('data-geo-camada');
      areas.hidden = !atual.hasAttribute('data-rotulos-camada');
      leitura.classList.toggle('leitura--alta', atual.hasAttribute('data-com-legendas'));
      desenhar();
    }

    function mostrar(id) {
      var alvo = visor.querySelector('[data-camada="' + id + '"]');
      if (!alvo) return;
      visor.querySelectorAll('[data-camada]').forEach(function (el) { el.hidden = el !== alvo; });
      visor.querySelectorAll('[data-texto]').forEach(function (el) { el.hidden = el.dataset.texto !== id; });
      botoes.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.alvo === id)); });
      atual = alvo; est.ponto = null; est.lab = null;
      montar();
    }

    botoes.forEach(function (b) { b.addEventListener('click', function () { mostrar(b.dataset.alvo); }); });
    facetas.forEach(function (b) {
      b.addEventListener('click', function () {
        fac[b.dataset.faceta] = b.dataset.valor;
        facetas.forEach(function (x) { x.setAttribute('aria-pressed', String(fac[x.dataset.faceta] === x.dataset.valor)); });
        mostrar(visor.dataset.chave.replace(/\{(\w+)\}/g, function (_, k) { return fac[k]; }));
      });
    });

    visor.querySelectorAll('[data-geo]').forEach(function (m) {
      function mover(e) {
        if (!(est.coord || est.escala)) return;
        var r = m.getBoundingClientRect();
        if (!r.width) return;
        var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height, g = lerGeo(m);
        if (fx < g.bx0 || fx > g.bx1 || fy < g.by0 || fy > g.by1) { if (est.ponto) { est.ponto = null; desenhar(); } return; }
        var u = (fx - g.bx0) / (g.bx1 - g.bx0), v = (fy - g.by0) / (g.by1 - g.by0);
        var lon = g.x0 + u * (g.x1 - g.x0);
        if (lon < -180) lon += 360; else if (lon > 180) lon -= 360;
        est.ponto = { el: m, fx: fx, fy: fy, lat: g.y1 - v * (g.y1 - g.y0), lon: lon };
        desenhar();
      }
      m.addEventListener('mousemove', mover);
      m.addEventListener('click', mover);
      m.addEventListener('mouseleave', function () { if (est.ponto) { est.ponto = null; desenhar(); } });
    });

    visor.querySelectorAll('.rotulo').forEach(function (b) {
      function abrir() { if (est.nome && est.lab !== b) { est.lab = b; desenhar(); } }
      function fechar() { if (est.lab === b) { est.lab = null; desenhar(); } }
      b.addEventListener('mouseenter', abrir);
      b.addEventListener('focus', abrir);
      b.addEventListener('click', abrir);
      b.addEventListener('mouseleave', fechar);
      b.addEventListener('blur', fechar);
    });

    menu.addEventListener('click', function () { est.menu = !est.menu; desenhar(); });
    ferr.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && est.menu) { est.menu = false; desenhar(); menu.focus(); }
    });
    painel.querySelectorAll('[data-chave]').forEach(function (b) {
      b.addEventListener('click', function () { est[b.dataset.chave] = !est[b.dataset.chave]; est.ponto = null; desenhar(); });
    });
    areas.querySelectorAll('[data-areas-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.areasBtn === 'num') {
          est.num = !est.num;
          if (!est.num) { est.nome = false; est.lab = null; }
        } else {
          est.nome = !est.nome;
          if (est.nome) est.num = true; else est.lab = null;
        }
        desenhar();
      });
    });

    montar();
  });
})();
