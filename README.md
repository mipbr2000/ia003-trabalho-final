# Trabalho final de Probabilidade e Estatística para IA — amostragem, intervalos de confiança e testes de hipóteses

Análise das pessoas ocupadas nos microdados da PNAD Contínua (IBGE), 2º trimestre de 2026:
população de estudo, amostra aleatória simples e inferência, apresentadas em três painéis interativos.

## Painéis

- Painel 1 — população: https://mipbr2000.github.io/ia003-trabalho-final/
- Painel 2 — amostra: https://mipbr2000.github.io/ia003-trabalho-final/amostra.html
- Painel 3 — inferência e comparação: https://mipbr2000.github.io/ia003-trabalho-final/inferencia.html

## Vídeo de apresentação

https://youtu.be/lrGHd66OT9k

## Base de dados

Fonte: IBGE, PNAD Contínua trimestral, microdados do 2º trimestre de 2026.
https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Trimestral/Microdados/2026/PNADC_022026.zip

## Como reproduzir

Requer Python 3 com `pandas`, `numpy`, `scipy` e `pyarrow`. Baixe e descompacte em `dados/` o arquivo
de microdados acima e o dicionário (`Documentacao/Dicionario_e_input_20221031.zip`, na mesma área do IBGE). Depois:

```bash
python3 src/preparar_dados.py   # lê os microdados e grava dados/populacao.parquet
python3 src/sortear_amostra.py  # calcula n e sorteia a amostra (semente fixa)
python3 src/gerar_paineis.py    # calcula resumos e inferência e grava docs/dados.js
```

Os três scripts podem ser executados repetidas vezes com o mesmo resultado.
