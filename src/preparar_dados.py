"""Lê os microdados da PNAD Contínua (largura fixa) e grava a população de estudo em Parquet.

Idempotente: sobrescreve o Parquet com o mesmo conteúdo a cada execução.
"""
import re
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
LAYOUT = RAIZ / "dados" / "input_PNADC_trimestral.txt"
MICRODADOS = RAIZ / "dados" / "PNADC_022026.txt"
SAIDA = RAIZ / "dados" / "populacao.parquet"

VARIAVEIS = {
    "UF": "uf", "V1022": "situacao", "V2007": "sexo", "V2009": "idade",
    "V2010": "cor", "VD3004": "instrucao", "VD4002": "ocupacao",
    "VD4019": "renda", "V4039": "horas",
}
UF_REGIAO = {"1": "Norte", "2": "Nordeste", "3": "Sudeste", "4": "Sul", "5": "Centro-Oeste"}
SEXO = {"1": "Homem", "2": "Mulher"}
SITUACAO = {"1": "Urbana", "2": "Rural"}
COR = {"1": "Branca", "2": "Preta", "3": "Amarela", "4": "Parda", "5": "Indígena", "9": "Ignorado"}
INSTRUCAO = {
    "1": "Sem instrução", "2": "Fundamental incompleto", "3": "Fundamental completo",
    "4": "Médio incompleto", "5": "Médio completo", "6": "Superior incompleto",
    "7": "Superior completo",
}
CODIGO_OCUPADO = "1"
CODIGO_SUPERIOR_COMPLETO = "7"


def ler_layout():
    padrao = re.compile(r"\s*@(\d+)\s+(\S+)\s+\$?(\d+)\.")
    posicoes = {}
    for linha in LAYOUT.read_text(encoding="latin-1").splitlines():
        m = padrao.match(linha)
        if m and m[2] in VARIAVEIS:
            inicio = int(m[1]) - 1
            posicoes[m[2]] = (inicio, inicio + int(m[3]))
    faltando = set(VARIAVEIS) - set(posicoes)
    if faltando:
        raise ValueError(f"Variáveis ausentes no layout: {faltando}")
    return posicoes


def main():
    posicoes = ler_layout()
    bruto = pd.read_fwf(
        MICRODADOS, colspecs=[posicoes[v] for v in VARIAVEIS], names=list(VARIAVEIS.values()),
        dtype=str, encoding="latin-1",
    )
    total_registros = len(bruto)
    ocupados = bruto[bruto["ocupacao"] == CODIGO_OCUPADO]
    pop = ocupados.dropna(subset=["renda", "horas", "instrucao"]).copy()

    pop["renda"] = pop["renda"].astype(int)
    pop["horas"] = pop["horas"].astype(int)
    pop["idade"] = pop["idade"].astype(int)
    pop["regiao"] = pop["uf"].str[0].map(UF_REGIAO)
    pop["superior"] = (pop["instrucao"] == CODIGO_SUPERIOR_COMPLETO).map({True: "Sim", False: "Não"})
    pop["sexo"] = pop["sexo"].map(SEXO)
    pop["situacao"] = pop["situacao"].map(SITUACAO)
    pop["cor"] = pop["cor"].map(COR)
    pop["instrucao"] = pop["instrucao"].map(INSTRUCAO)
    pop = pop.drop(columns=["ocupacao", "uf"]).reset_index(drop=True)
    pop.insert(0, "id", range(1, len(pop) + 1))

    if pop.isna().any().any():
        raise ValueError(f"Valores ausentes após limpeza:\n{pop.isna().sum()}")
    pop.to_parquet(SAIDA, index=False)

    print(f"Registros no arquivo original: {total_registros}")
    print(f"Ocupados: {len(ocupados)}")
    print(f"População de estudo (ocupados com renda e horas): {len(pop)}")
    print(pop.describe().T)
    for c in ["sexo", "situacao", "superior", "cor", "regiao", "instrucao"]:
        print(pop[c].value_counts(normalize=True).round(4).to_string(), "\n")


if __name__ == "__main__":
    main()
