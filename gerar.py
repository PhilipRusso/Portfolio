"""Gera o site estático do Atlas de projetos a partir dos arquivos em conteudo/.

Uso:  python gerar.py
Lê   conteudo/<idioma>/site.yml, conteudo/<idioma>/inicio.yml e conteudo/<idioma>/pranchas/*.yml
Gera index.html e pranchas/*.html (português) e en/index.html e en/pranchas/*.html (inglês).
A ordem das pranchas segue o prefixo numérico do nome do arquivo (01-, 02-, ...).
"""
import os
import re
import sys
from itertools import groupby

import yaml
from jinja2 import Environment, FileSystemLoader

RAIZ = os.path.dirname(os.path.abspath(__file__))
IDIOMAS = {'pt': '', 'en': 'en'}  # idioma -> pasta de saída


def ler(caminho):
    with open(caminho, encoding='utf-8') as f:
        return yaml.safe_load(f) or {}


def carregar(idioma):
    base = os.path.join(RAIZ, 'conteudo', idioma)
    site = ler(os.path.join(base, 'site.yml'))
    inicio = ler(os.path.join(base, 'inicio.yml'))
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
        if p['visor'].get('inicial') not in ids:
            p['visor']['inicial'] = ids[0] if ids else None
        p['grupos'] = [{'rotulo': g, 'camadas': list(cs)} for g, cs in groupby(camadas, key=lambda c: c.get('grupo', ''))]
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
