// Painel descritivo: o mesmo código serve à população (Painel 1) e à amostra (Painel 2).
const QUANT = ["renda", "idade", "horas"];
const QUALI = ["sexo", "situacao", "superior", "instrucao", "cor", "regiao"];
const CASAS = { renda: 2, idade: 2, horas: 2 };
const MEDIDAS = [
  ["media", "Média"], ["mediana", "Mediana"], ["dp", "Desvio-padrão"], ["cv", "Coef. de variação"],
  ["min", "Mínimo"], ["q1", "1º quartil"], ["q3", "3º quartil"], ["max", "Máximo"],
];
const INDICADORES = [
  ["Renda média (R$)", (r) => r.quant.renda.media, fmt],
  ["Renda mediana (R$)", (r) => r.quant.renda.mediana, fmt],
  ["Idade média (anos)", (r) => r.quant.idade.media, fmt],
  ["Horas semanais médias", (r) => r.quant.horas.media, fmt],
  ["Mulheres", (r) => r.quali.sexo.pct[1], fmtPct],
  ["Superior completo", (r) => r.quali.superior.pct[0], fmtPct],
  ["Área urbana", (r) => r.quali.situacao.pct[0], fmtPct],
];

function chaveFiltro() {
  return ["regiao", "sexo"].map((f) => document.getElementById("filtro-" + f).value).join("|");
}

function montarFiltros(aoMudar) {
  const nomes = { regiao: "Grande região", sexo: "Sexo" };
  document.getElementById("filtros").innerHTML = Object.entries(DADOS.meta.filtros)
    .map(([f, opcoes]) => `<label>${nomes[f]}<select id="filtro-${f}">${opcoes.map((o) => `<option>${o}</option>`).join("")}</select></label>`)
    .join("");
  document.querySelectorAll("#filtros select").forEach((s) => s.addEventListener("change", aoMudar));
}

function desenharIndicadores(resumo, referencia) {
  const cartoes = [["Observações", (r) => r.n, fmtInt], ...INDICADORES].map(([rotulo, valor, formato]) => {
    const ref = referencia ? `<div class="ref">População: ${formato(valor(referencia))}</div>` : "";
    return `<div class="cartao"><div class="rotulo">${rotulo}</div><div class="valor">${formato(valor(resumo))}</div>${ref}</div>`;
  });
  document.getElementById("indicadores").innerHTML = cartoes.join("");
}

function desenharTabela(resumo, referencia, base) {
  const celula = (q, m) => (m === "cv" ? fmtPct(100 * q[m]) : fmt(q[m], CASAS.renda));
  const linhas = [];
  QUANT.forEach((v) => {
    linhas.push(`<tr><td>${ROTULO[v]} — ${NOME_BASE[base]}</td>${MEDIDAS.map(([m]) => `<td>${celula(resumo.quant[v], m)}</td>`).join("")}</tr>`);
    if (referencia)
      linhas.push(`<tr style="color:${COR.populacao}"><td>${ROTULO[v]} — População</td>${MEDIDAS.map(([m]) => `<td>${celula(referencia.quant[v], m)}</td>`).join("")}</tr>`);
  });
  document.getElementById("tabela").innerHTML =
    `<table><thead><tr><th>Variável</th>${MEDIDAS.map(([, n]) => `<th>${n}</th>`).join("")}</tr></thead><tbody>${linhas.join("")}</tbody></table>`;
}

function desenharHistograma(v, resumo, referencia, base) {
  const h = resumo.quant[v].hist;
  const tracos = [{ type: "bar", x: h.x, y: h.pct, name: NOME_BASE[base], marker: { color: COR[base] },
    hovertemplate: "Classe centrada em %{x}<br>%{y:.2f}% das observações<extra></extra>" }];
  if (referencia)
    tracos.push({ type: "scatter", mode: "lines", x: referencia.quant[v].hist.x, y: referencia.quant[v].hist.pct,
      name: "População", line: { color: COR.populacao, width: 2, shape: "hvh" } });
    Plotly.react("hist-" + v, tracos, { title: { text: "Histograma — " + CURTO[v], font: { size: 13 } },
    margin: MARGEM, bargap: 0.05, yaxis: { title: "% das observações" }, xaxis: { title: ROTULO[v] },
    legend: { orientation: "h", y: -0.25 }, showlegend: Boolean(referencia) }, CONFIG_PLOTLY);
}

function caixa(q, nome, cor) {
  return { type: "box", orientation: "h", name: nome, y: [nome], q1: [q.q1], median: [q.mediana], q3: [q.q3],
    lowerfence: [q.bigode_inf], upperfence: [q.bigode_sup], mean: [q.media], boxmean: true, marker: { color: cor } };
}

function desenharCaixa(v, resumo, referencia, base) {
  const tracos = [caixa(resumo.quant[v], NOME_BASE[base], COR[base])];
  if (referencia) tracos.push(caixa(referencia.quant[v], "População", COR.populacao));
  Plotly.react("caixa-" + v, tracos, { title: { text: "Boxplot — " + CURTO[v], font: { size: 13 } },
    margin: { ...MARGEM, l: 80 }, showlegend: false, xaxis: { title: ROTULO[v] } }, CONFIG_PLOTLY);
}

function desenharBarras(v, resumo, referencia, base) {
  const q = resumo.quali[v];
  const tracos = [{ type: "bar", x: q.categorias, y: q.pct, customdata: q.n, name: NOME_BASE[base], marker: { color: COR[base] },
    text: q.pct.map((p) => fmtPct(p, 1)), textposition: "auto",
    hovertemplate: "%{x}<br>%{y:.2f}% (%{customdata} observações)<extra></extra>" }];
  if (referencia)
    tracos.push({ type: "bar", x: referencia.quali[v].categorias, y: referencia.quali[v].pct, name: "População",
      marker: { color: COR.populacao }, text: referencia.quali[v].pct.map((p) => fmtPct(p, 1)), textposition: "auto" });
  Plotly.react("barras-" + v, tracos, { title: { text: "Proporções — " + CURTO[v], font: { size: 13 } },
    margin: { ...MARGEM, b: 90 }, barmode: "group", yaxis: { title: "%" }, legend: { orientation: "h", y: -0.45 },
    showlegend: Boolean(referencia) }, CONFIG_PLOTLY);
}

function desenharFrequencias(resumo, base) {
  const linhas = QUALI.flatMap((v) => resumo.quali[v].categorias.map((c, i) =>
    `<tr><td>${ROTULO[v]}</td><td style="text-align:left">${c}</td><td>${fmtInt(resumo.quali[v].n[i])}</td><td>${fmtPct(resumo.quali[v].pct[i])}</td></tr>`));
  document.getElementById("frequencias").innerHTML =
    `<table><thead><tr><th>Variável</th><th style="text-align:left">Categoria</th><th>Frequência (${NOME_BASE[base]})</th><th>Proporção</th></tr></thead><tbody>${linhas.join("")}</tbody></table>`;
}

function montarPainelDescritivo(base) {
  const comparar = base === "amostra";
  const graficos = document.getElementById("graficos");
  graficos.innerHTML = [...QUANT.map((v) => `hist-${v}`), ...QUANT.map((v) => `caixa-${v}`), ...QUALI.map((v) => `barras-${v}`)]
    .map((id) => `<div id="${id}" class="grafico"></div>`).join("");
  const atualizar = () => {
    const chave = chaveFiltro();
    const resumo = DADOS[base][chave];
    const referencia = comparar ? DADOS.populacao[chave] : null;
    desenharIndicadores(resumo, referencia);
    desenharTabela(resumo, referencia, base);
    QUANT.forEach((v) => { desenharHistograma(v, resumo, referencia, base); desenharCaixa(v, resumo, referencia, base); });
    QUALI.forEach((v) => desenharBarras(v, resumo, referencia, base));
    desenharFrequencias(resumo, base);
  };
  montarFiltros(atualizar);
  atualizar();
}
