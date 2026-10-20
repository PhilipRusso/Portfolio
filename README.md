# Atlas de projetos — Philip Russo

Portfólio bilíngue (PT/EN) publicado em **https://philiprusso.github.io/Portfolio/** (GitHub Pages).

## Como editar

Todo o texto fica em arquivos YAML dentro de `conteudo/`. Não é preciso mexer no HTML.

| O que mudar | Arquivo |
|---|---|
| Uma prancha (título, textos, camadas do mapa, números) | `conteudo/pt/pranchas/NN-nome.yml` e `conteudo/en/pranchas/NN-nome.yml` |
| Página inicial (apresentação, números, ferramentas, publicações, sobre) | `conteudo/pt/inicio.yml` e `conteudo/en/inicio.yml` |
| Textos fixos da interface e das legendas | `conteudo/pt/site.yml` e `conteudo/en/site.yml` |

**Pelo próprio GitHub:** abra o arquivo, clique no lápis (Edit), altere e clique em *Commit changes*.
Em um ou dois minutos o workflow **Gerar site** (aba *Actions*) regera o HTML e o site é atualizado.

Dicas:

- Mantenha a indentação (dois espaços). Textos longos podem começar com `>-` e continuar nas linhas de baixo.
- Dá para usar HTML simples nos textos: `<em>itálico</em>`, `<strong>negrito</strong>`, `<a href="...">link</a>`.
- Se um texto tiver `: ` (dois-pontos seguido de espaço) no meio, coloque-o entre aspas simples.
- **Imagens:** envie para `assets/img/` (*Add file → Upload files*) e use só o nome do arquivo no campo `src` ou `imagem`.
- **Nova prancha:** copie um arquivo de `pranchas/` com o próximo número (ex.: `09-novo.yml`) nas duas línguas.
  O número no início define a ordem; o resto do nome vira o endereço da página.
- **Ordem das camadas:** segue a ordem da lista `camadas`; o campo `grupo` agrupa os botões; `inicial` escolhe a camada que abre primeiro.
- **Legendas de cor:** `legenda` aceita `adequabilidade`, `limiar`, `presenca` ou `ceratium`.
- **CV:** coloque o PDF em `assets/cv/` e escreva o caminho no campo `cv` do `inicio.yml`; o botão aparece sozinho.

## Ver no computador antes de publicar

```bash
pip install -r requirements.txt
python gerar.py
python -m http.server 8000
```

Depois abra http://localhost:8000.

## Estrutura

```
conteudo/   textos em YAML (pt e en)
modelos/    modelos HTML (Jinja2)
assets/     css, js e imagens
gerar.py    gera index.html, pranchas/ e en/
```

O código das ferramentas citadas no site não está neste repositório.
