"""Gera o site estático do Atlas de projetos a partir dos arquivos em conteudo/.

Uso:  python gerar.py
Lê   conteudo/<idioma>/site.yml, conteudo/<idioma>/inicio.yml, conteudo/<idioma>/pranchas/*.yml e conteudo/rotulos/*.yml
Gera index.html e pranchas/*.html (português) e en/index.html e en/pranchas/*.html (inglês).
A ordem das pranchas segue o prefixo numérico do nome do arquivo (01-, 02-, ...).
"""
import os
import re
import sys
from itertools import groupby

import yaml
from jinja2 import Environment, FileSystemLoader
from PIL import Image

RAIZ = os.path.dirname(os.path.abspath(__file__))
IDIOMAS = {'pt': '', 'en': 'en'}  # idioma -> pasta de saída
LARGURA_REF = 1296   # largura de referência da moldura do mapa, em px, para calcular a proporção dos painéis
FAIXA_TOPO = 52      # faixa no topo das molduras com dois ou mais mapas, para o botão Elementos do mapa
LEGENDA_IMG = 25     # altura da legenda sob cada mapa de um painel, em px
_PROP = {}


def proporcao_img(src):
    """Largura / altura da imagem em assets/img/."""
    if src not in _PROP:
        with Image.open(os.path.join(RAIZ, 'assets', 'img', src)) as im:
            _PROP[src] = im.size[0] / im.size[1]
    return _PROP[src]


def px(valor):
    return float(str(valor).replace('px', '') or 0)


def razao(texto):
    a, _, b = str(texto).partition('/')
    return float(a) / float(b or 1)


def preparar_camada(c, visor, rotulos, lang):
    """Calcula o que o modelo precisa para desenhar os mapas da camada: proporção de cada imagem, recorte nos
    painéis, extensão geográfica, posição da escala e da rosa, grade e proporção da moldura."""
    imgs = c.get('imagens', [])
    n = len(imgs)
    cols = c.get('colunas', n) or 1
    rows = -(-n // cols)
    prop = c.get('proporcao', visor.get('proporcao', '16 / 10'))
    margem = px(visor.get('margem', '0px'))
    cortar = n > 1 and all(im.get('recorte') and im.get('geo') for im in imgs)
    for i, im in enumerate(imgs):
        ar = proporcao_img(im['src'])
        im.update(iw='100%', ih='100%', il='0%', it='0%', cortar=False, ultimo=(i == n - 1))
        el = im.get('elementos', {})
        im['canto'] = 'r'
        if im.get('geo'):
            geo = list(im['geo'])
            if cortar:
                # mostra só a área recortada; extensão geográfica e proporção acompanham o recorte
                cx0, cy0, cx1, cy1 = im['recorte']
                cw, ch = cx1 - cx0, cy1 - cy0
                x0, x1, y0, y1 = geo[:4]
                geo = [x0 + cx0 * (x1 - x0), x0 + cx1 * (x1 - x0), y1 - cy1 * (y1 - y0), y1 - cy0 * (y1 - y0)] + geo[4:]
                ar = ar * cw / ch
                im.update(iw=f'{100 / cw:.4f}%', ih=f'{100 / ch:.4f}%', il=f'{-cx0 / cw * 100:.4f}%', it=f'{-cy0 / ch * 100:.4f}%', cortar=True)
                im['canto'] = 'l'   # sem o oceano das bordas, escala e rosa vão para o canto inferior esquerdo
            im['geo_txt'] = ','.join(f'{v:.4f}' for v in geo)
            if el is False:
                im['sem_elementos'] = True
            else:
                el = el or {}
                im['dir'] = el.get('direita', 3)
                im['base'] = el.get('base', 0)
                im['rosa'] = el.get('rosa', 5.5)
        im['ar'] = f'{ar:.5f}'
        if im.get('rotulos'):
            R = rotulos[im['rotulos']]
            d = R['diametro']
            itens = []
            for r in R['itens']:
                direita = r['lado'] == 'direita'
                itens.append(dict(n=r['n'], nome=r[lang], y=r['y'], lado='d' if direita else 'e',
                                  pos=f"{(r['x'] - d / 2) if direita else (100 - r['x'] - d / 2):.3f}",
                                  mw=f"{min(30, (100 - r['x'] if direita else r['x']) - d / 2 + 9):.2f}"))
            im['rot'] = dict(linhas=R['linhas'], d=d, itens=itens)
    if cortar:
        cap = LEGENDA_IMG if any(im.get('legenda') for im in imgs) else 0
        pw = (LARGURA_REF - 2 * margem - (cols - 1) * 12) / cols
        alt = rows * (pw / float(imgs[0]['ar']) + cap) + (rows - 1) * 12 + 2 * margem
        prop = f'{LARGURA_REF / alt:.3f} / 1'
    topo = margem
    if n > 1 and any(im.get('geo') for im in imgs):
        topo = margem + FAIXA_TOPO
        prop = f'{LARGURA_REF / (LARGURA_REF / razao(prop) + FAIXA_TOPO):.3f} / 1'
    c.update(_cols=cols, _rows=rows, _prop=prop, _topo=f'{topo:g}px', _geo=any(im.get('geo') for im in imgs),
             _rot=any(im.get('rot') for im in imgs), _leg=any(im.get('legenda') for im in imgs))


def ler(caminho):
    with open(caminho, encoding='utf-8') as f:
        return yaml.safe_load(f) or {}


def carregar(idioma):
    base = os.path.join(RAIZ, 'conteudo', idioma)
    site = ler(os.path.join(base, 'site.yml'))
    inicio = ler(os.path.join(base, 'inicio.yml'))
    pasta_rot = os.path.join(RAIZ, 'conteudo', 'rotulos')
    rotulos = {n[:-4]: ler(os.path.join(pasta_rot, n)) for n in os.listdir(pasta_rot) if n.endswith('.yml')} if os.path.isdir(pasta_rot) else {}
    pranchas = []
    pasta = os.path.join(base, 'pranchas')
    for nome in sorted(os.listdir(pasta)):
        if not nome.endswith('.yml'):
            continue
        p = ler(os.path.join(pasta, nome))
        p['slug'] = re.sub(r'^\d+-', '', nome[:-4])
        pranchas.append(p)
    for i, p in enumerate(pranchas):
        p['numero'] = i + 1
        camadas = p.get('camadas', [])
        ids = [c['id'] for c in camadas]
        if len(set(ids)) != len(ids):
            sys.exit(f'[{idioma}] {p["slug"]}: ids de camada repetidos')
        p.setdefault('visor', {})
        v = p['visor']
        if v.get('chave'):
            # camadas escolhidas por facetas (por exemplo, modelo × mapa): os botões mudam uma faceta de cada vez
            v['inicial'] = v['chave'].format(**v['facetas'])
            for g in p['grupos']:
                for b in g['botoes']:
                    b['ativo'] = v['facetas'].get(b['faceta']) == b['valor']
        else:
            if v.get('inicial') not in ids:
                v['inicial'] = ids[0] if ids else None
            p['grupos'] = [{'rotulo': g, 'camadas': list(cs)} for g, cs in groupby(camadas, key=lambda c: c.get('grupo', ''))]
        if v['inicial'] not in ids:
            sys.exit(f'[{idioma}] {p["slug"]}: a camada inicial {v["inicial"]} não existe')
        for c in camadas:
            preparar_camada(c, v, rotulos, idioma)
    return site, inicio, pranchas


def url(idioma, pagina):
    """Caminho a partir da raiz do site para uma página num idioma (vira relativo na hora de gravar)."""
    pasta = IDIOMAS[idioma]
    return '/' + (pasta + '/' if pasta else '') + pagina


def relativizar(html, caminho):
    """Troca links que começam com / por caminhos relativos à página, para o site funcionar em qualquer pasta
    (por exemplo, usuario.github.io/Portfolio/) e também aberto direto do disco."""
    prefixo = '../' * caminho.count('/')
    return re.sub(r'(href|src)="/(?!/)', lambda m: f'{m.group(1)}="{prefixo}', html)


def escrever(caminho, html, gerados):
    destino = os.path.join(RAIZ, caminho)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(relativizar(html, caminho))
    gerados.append(caminho)


def main():
    env = Environment(loader=FileSystemLoader(os.path.join(RAIZ, 'modelos')),
                      autoescape=False, trim_blocks=True, lstrip_blocks=True)
    env.globals['url'] = url
    gerados = []
    # apaga as páginas de pranchas geradas antes, para não sobrarem páginas de pranchas renomeadas
    for lang, pasta in IDIOMAS.items():
        d = os.path.join(RAIZ, pasta, 'pranchas') if pasta else os.path.join(RAIZ, 'pranchas')
        if os.path.isdir(d):
            for nome in os.listdir(d):
                if nome.endswith('.html'):
                    os.remove(os.path.join(d, nome))
    dados = {lang: carregar(lang) for lang in IDIOMAS}
    slugs = {lang: [p['slug'] for p in d[2]] for lang, d in dados.items()}
    if len(set(tuple(s) for s in slugs.values())) != 1:
        sys.exit(f'As pranchas não batem entre os idiomas: {slugs}')
    for lang, (site, inicio, pranchas) in dados.items():
        outro = 'en' if lang == 'pt' else 'pt'
        pasta = IDIOMAS[lang] + '/' if IDIOMAS[lang] else ''
        comum = dict(lang=lang, outro=outro, site=site, pranchas=pranchas)
        html = env.get_template('inicio.html').render(**comum, inicio=inicio, pagina='index.html')
        escrever(pasta + 'index.html', html, gerados)
        for i, p in enumerate(pranchas):
            ant = pranchas[i - 1] if i > 0 else None
            prox = pranchas[i + 1] if i < len(pranchas) - 1 else None
            html = env.get_template('prancha.html').render(**comum, p=p, ant=ant, prox=prox, total=len(pranchas),
                                                          pagina=f'pranchas/{p["slug"]}.html')
            escrever(f'{pasta}pranchas/{p["slug"]}.html', html, gerados)
    print('Gerados:', len(gerados), 'arquivos')
    for g in gerados:
        print('  ', g)


if __name__ == '__main__':
    main()
