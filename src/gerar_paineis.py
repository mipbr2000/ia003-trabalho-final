"""Calcula resumos descritivos, inferência e simulação e grava docs/dados.js para os painéis.

Idempotente: sementes fixas; sobrescreve docs/dados.js com o mesmo conteúdo a cada execução.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

RAIZ = Path(__file__).resolve().parent.parent
POPULACAO = RAIZ / "dados" / "populacao.parquet"
AMOSTRA = RAIZ / "dados" / "amostra.parquet"
SAIDA = RAIZ / "docs" / "dados.js"

TODOS = "Todos"
FILTROS = ["regiao", "sexo"]
QUALITATIVAS = ["sexo", "situacao", "superior", "instrucao", "cor", "regiao"]
# variável: (início, fim, largura da classe) do histograma; valores acima do fim entram na última classe
QUANTITATIVAS = {"renda": (0, 20000, 500), "idade": (10, 100, 5), "horas": (0, 120, 5)}
ORDEM_CATEGORIAS = {
    "sexo": ["Homem", "Mulher"],
    "situacao": ["Urbana", "Rural"],
    "superior": ["Sim", "Não"],
    "instrucao": ["Sem instrução", "Fundamental incompleto", "Fundamental completo",
                  "Médio incompleto", "Médio completo", "Superior incompleto", "Superior completo"],
    "cor": ["Branca", "Preta", "Amarela", "Parda", "Indígena", "Ignorado"],
    "regiao": ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"],
}

NIVEIS_CONFIANCA = [0.90, 0.95, 0.99]
SALARIO_MINIMO_2026 = 1621
JORNADA_REFERENCIA = 40
LIMITE_BIGODE = 1.5
MINIMO_SUCESSOS_FRACASSOS = 10
SIMULACOES = 100
SEMENTE_SIMULACAO = 7

TESTES = [
    {"id": "mulheres", "tipo": "proporcao", "variavel": "sexo", "evento": "Mulher",
     "titulo": "Proporção de mulheres entre os ocupados", "curto": "Mulheres", "ref": 0.5, "h1": "menor",
     "justificativa": "0,50 representa a paridade entre homens e mulheres no mercado de trabalho. "
                      "A pergunta é se as mulheres são minoria entre as pessoas ocupadas."},
    {"id": "superior", "tipo": "proporcao", "variavel": "superior", "evento": "Sim",
     "titulo": "Proporção de ocupados com ensino superior completo", "curto": "Superior completo", "ref": 0.25, "h1": "diferente",
     "justificativa": "Testa a afirmação de que um em cada quatro trabalhadores tem ensino superior "
                      "completo (valor de referência hipotético, escolhido para o exercício)."},
    {"id": "horas", "tipo": "media", "variavel": "horas", "unidade": "h/semana",
     "titulo": "Média de horas habituais de trabalho por semana", "curto": "Horas semanais", "ref": JORNADA_REFERENCIA, "h1": "menor",
     "justificativa": "40 horas é a jornada semanal de referência. A pergunta é se, em média, "
                      "os ocupados trabalham menos do que isso."},
    {"id": "renda", "tipo": "media", "variavel": "renda", "unidade": "R$/mês",
     "titulo": "Renda média mensal habitual do trabalho", "curto": "Renda média", "ref": 2 * SALARIO_MINIMO_2026, "h1": "maior",
     "justificativa": f"R$ {2 * SALARIO_MINIMO_2026} equivale a dois salários mínimos de 2026 "
                      f"(2 × R$ {SALARIO_MINIMO_2026}). A pergunta é se a renda média supera esse valor."},
]


def resumo_quantitativa(serie, classes):
    inicio, fim, largura = classes
    q1, mediana, q3 = serie.quantile([0.25, 0.5, 0.75])
    iqr = q3 - q1
    dentro = serie[(serie >= q1 - LIMITE_BIGODE * iqr) & (serie <= q3 + LIMITE_BIGODE * iqr)]
    bordas = np.arange(inicio, fim + largura, largura)
    contagens, _ = np.histogram(serie.clip(upper=fim - 1e-9), bins=bordas)
    media, dp = serie.mean(), serie.std(ddof=1) if len(serie) > 1 else 0.0
    return {
        "media": media, "mediana": mediana, "dp": dp, "cv": dp / media if media else None,
        "min": serie.min(), "q1": q1, "q3": q3, "max": serie.max(),
        "bigode_inf": dentro.min(), "bigode_sup": dentro.max(),
        "hist": {"x": (bordas[:-1] + largura / 2).tolist(),
                 "pct": (100 * contagens / len(serie)).tolist()},
    }


def resumo_qualitativa(serie, categorias):
    contagens = serie.value_counts().reindex(categorias, fill_value=0)
    return {"categorias": categorias, "n": contagens.tolist(),
            "pct": (100 * contagens / len(serie)).tolist()}


def resumo(df):
    return {
        "n": len(df),
        "quant": {v: resumo_quantitativa(df[v], c) for v, c in QUANTITATIVAS.items()},
        "quali": {v: resumo_qualitativa(df[v], ORDEM_CATEGORIAS[v]) for v in QUALITATIVAS},
    }


def resumos_por_filtro(df):
    opcoes = [[TODOS] + ORDEM_CATEGORIAS[f] for f in FILTROS]
    saida = {}
    for regiao in opcoes[0]:
        for sexo in opcoes[1]:
            recorte = df
            if regiao != TODOS:
                recorte = recorte[recorte["regiao"] == regiao]
            if sexo != TODOS:
                recorte = recorte[recorte["sexo"] == sexo]
            saida[f"{regiao}|{sexo}"] = resumo(recorte)
    return saida


def p_valor(estatistica, h1, distribuicao):
    if h1 == "menor":
        return distribuicao.cdf(estatistica)
    if h1 == "maior":
        return distribuicao.sf(estatistica)
    return 2 * distribuicao.sf(abs(estatistica))


def h1_verdadeira(parametro, ref, h1):
    return {"menor": parametro < ref, "maior": parametro > ref, "diferente": parametro != ref}[h1]


def classificar(rejeita, h1_real):
    if rejeita and h1_real:
        return "Decisão correta: H0 é falsa na população e foi rejeitada."
    if rejeita and not h1_real:
        return "Erro tipo I: H0 é verdadeira na população, mas foi rejeitada."
    if not rejeita and h1_real:
        return "Erro tipo II: H0 é falsa na população, mas a amostra não reuniu evidência para rejeitá-la."
    return "Decisão correta: H0 não é falsa na direção de H1 e não foi rejeitada."


def inferir_proporcao(teste, pop, amostra, confianca):
    n = len(amostra)
    sucessos = int((amostra[teste["variavel"]] == teste["evento"]).sum())
    p_chapeu, p0 = sucessos / n, teste["ref"]
    z_critico = stats.norm.ppf(1 - (1 - confianca) / 2)
    ep_ic = np.sqrt(p_chapeu * (1 - p_chapeu) / n)
    ep_teste = np.sqrt(p0 * (1 - p0) / n)
    z = (p_chapeu - p0) / ep_teste
    condicoes_ok = min(n * p0, n * (1 - p0), sucessos, n - sucessos) >= MINIMO_SUCESSOS_FRACASSOS
    return {
        "estimativa": p_chapeu, "ep": ep_ic, "ic": [p_chapeu - z_critico * ep_ic, p_chapeu + z_critico * ep_ic],
        "estat_nome": "z", "estat": z, "p_valor": p_valor(z, teste["h1"], stats.norm), "n": n,
        "parametro": float((pop[teste["variavel"]] == teste["evento"]).mean()),
        "condicoes": f"Amostra aleatória simples; n·p0 = {n * p0:.0f} e n·(1−p0) = {n * (1 - p0):.0f}; "
                     f"{sucessos} sucessos e {n - sucessos} fracassos na amostra (todos ≥ {MINIMO_SUCESSOS_FRACASSOS}): "
                     f"aproximação normal {'adequada' if condicoes_ok else 'NÃO adequada'}. "
                     f"Fração amostral n/N = {n / len(pop):.1%}, correção de população finita desprezível.",
    }


def inferir_media(teste, pop, amostra, confianca):
    x = amostra[teste["variavel"]]
    n, media, dp = len(x), x.mean(), x.std(ddof=1)
    ep = dp / np.sqrt(n)
    dist = stats.t(df=n - 1)
    t_critico = dist.ppf(1 - (1 - confianca) / 2)
    t = (media - teste["ref"]) / ep
    return {
        "estimativa": media, "ep": ep, "ic": [media - t_critico * ep, media + t_critico * ep],
        "estat_nome": f"t ({n - 1} g.l.)", "estat": t, "p_valor": p_valor(t, teste["h1"], dist), "n": n,
        "parametro": float(pop[teste["variavel"]].mean()), "dp_amostral": dp,
        "condicoes": f"Amostra aleatória simples; desvio-padrão populacional tratado como desconhecido (teste t); "
                     f"n = {n} é grande, então o Teorema Central do Limite garante média amostral aproximadamente "
                     f"normal mesmo com distribuição assimétrica (assimetria amostral = {stats.skew(x):.2f}). "
                     f"Fração amostral n/N = {n / len(pop):.1%}, correção de população finita desprezível.",
    }


INFERIDORES = {"proporcao": inferir_proporcao, "media": inferir_media}


def inferencia(pop, amostra):
    saida = {}
    for confianca in NIVEIS_CONFIANCA:
        alfa = round(1 - confianca, 2)
        resultados = []
        for teste in TESTES:
            r = INFERIDORES[teste["tipo"]](teste, pop, amostra, confianca)
            rejeita = bool(r["p_valor"] < alfa)
            real = bool(h1_verdadeira(r["parametro"], teste["ref"], teste["h1"]))
            r.update({k: teste[k] for k in ("id", "tipo", "titulo", "curto", "ref", "h1", "justificativa")})
            r.update({"unidade": teste.get("unidade", ""), "alfa": alfa, "rejeita": rejeita,
                      "ic_contem_parametro": bool(r["ic"][0] <= r["parametro"] <= r["ic"][1]),
                      "avaliacao": classificar(rejeita, real)})
            resultados.append(r)
        saida[f"{confianca:.2f}"] = resultados
    return saida


def simulacao(pop, n, confianca=0.95):
    """Repete o sorteio para mostrar a variabilidade amostral do IC da renda média."""
    gerador = np.random.default_rng(SEMENTE_SIMULACAO)
    renda = pop["renda"].to_numpy()
    t_critico = stats.t(df=n - 1).ppf(1 - (1 - confianca) / 2)
    intervalos = []
    for _ in range(SIMULACOES):
        x = gerador.choice(renda, size=n, replace=False)
        margem = t_critico * x.std(ddof=1) / np.sqrt(n)
        intervalos.append([x.mean() - margem, x.mean(), x.mean() + margem])
    mu = renda.mean()
    cobertos = sum(lo <= mu <= hi for lo, _, hi in intervalos)
    return {"intervalos": intervalos, "parametro": mu, "cobertos": cobertos, "total": SIMULACOES,
            "confianca": confianca}


def para_json(obj):
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    raise TypeError(type(obj))


def main():
    pop, amostra = pd.read_parquet(POPULACAO), pd.read_parquet(AMOSTRA)
    dados = {
        "meta": {"N": len(pop), "n": len(amostra), "todos": TODOS,
                 "filtros": {f: [TODOS] + ORDEM_CATEGORIAS[f] for f in FILTROS}},
        "populacao": resumos_por_filtro(pop),
        "amostra": resumos_por_filtro(amostra),
        "inferencia": inferencia(pop, amostra),
        "simulacao": simulacao(pop, len(amostra)),
    }
    SAIDA.write_text("const DADOS = " + json.dumps(dados, default=para_json, ensure_ascii=False) + ";\n",
                     encoding="utf-8")
    print(f"Gravado {SAIDA} ({SAIDA.stat().st_size / 1024:.0f} KB)")
    for r in dados["inferencia"]["0.95"]:
        print(f"\n{r['titulo']}\n  H1: {r['h1']} que {r['ref']} | estimativa = {r['estimativa']:.4f} | "
              f"IC95% = [{r['ic'][0]:.4f}; {r['ic'][1]:.4f}] | {r['estat_nome']} = {r['estat']:.3f} | "
              f"p = {r['p_valor']:.3g} | rejeita H0: {r['rejeita']}\n  população = {r['parametro']:.4f} | "
              f"IC contém: {r['ic_contem_parametro']} | {r['avaliacao']}")
    s = dados["simulacao"]
    print(f"\nSimulação: {s['cobertos']}/{s['total']} ICs de 95% contêm a renda média populacional")


if __name__ == "__main__":
    main()
