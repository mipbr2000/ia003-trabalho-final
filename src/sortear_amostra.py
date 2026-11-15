"""Dimensiona e sorteia a amostra aleatória simples (sem reposição) da população de estudo.

Idempotente: a semente fixa garante a mesma amostra a cada execução.
"""
import math
from pathlib import Path

import pandas as pd
from scipy import stats

RAIZ = Path(__file__).resolve().parent.parent
POPULACAO = RAIZ / "dados" / "populacao.parquet"
AMOSTRA = RAIZ / "dados" / "amostra.parquet"

NIVEL_CONFIANCA = 0.95
MARGEM_ERRO = 0.02
PROPORCAO_PLANEJADA = 0.5  # máxima variância: cenário conservador
SEMENTE = 2026


def tamanho_amostra(n_populacao):
    z = stats.norm.ppf(1 - (1 - NIVEL_CONFIANCA) / 2)
    n_infinito = z**2 * PROPORCAO_PLANEJADA * (1 - PROPORCAO_PLANEJADA) / MARGEM_ERRO**2
    n_finito = n_infinito / (1 + (n_infinito - 1) / n_populacao)
    return z, n_infinito, math.ceil(n_finito)


def main():
    pop = pd.read_parquet(POPULACAO)
    z, n_infinito, n = tamanho_amostra(len(pop))
    amostra = pop.sample(n=n, replace=False, random_state=SEMENTE).sort_values("id")
    amostra.to_parquet(AMOSTRA, index=False)
    print(f"N = {len(pop)} | z = {z:.4f} | n0 = {n_infinito:.2f} | n = {n}")
    print(amostra[["idade", "renda", "horas"]].describe().T)
    for c in ["sexo", "situacao", "superior"]:
        print(amostra[c].value_counts(normalize=True).round(4).to_string(), "\n")


if __name__ == "__main__":
    main()
