// Painel 3: inferência a partir da amostra e comparação com os parâmetros da população.
const SIMBOLO_H1 = { menor: "<", maior: ">", diferente: "≠" };
const ehProporcao = (r) => r.tipo === "proporcao";
const simbolo = (r) => (ehProporcao(r) ? "p" : "μ");
const valor = (r, v) => (ehProporcao(r) ? fmtPct(100 * v) : fmt(v) + " " + r.unidade);

function desenharIntervalo(r, confianca) {
  const escala = ehProporcao(r) ? 100 : 1;
  const [lo, hi] = r.ic.map((v) => v * escala);
  const est = r.estimativa * escala, par = r.parametro * escala, ref = r.ref * escala;
  const linha = (x, cor, tipo) => ({ type: "line", x0: x, x1: x, y0: 0, y1: 1, yref: "paper", line: { color: cor, width: 2, dash: tipo } });
  Plotly.react("ic-" + r.id, [
    { type: "scatter", mode: "markers", x: [est], y: ["Amostra"], marker: { color: COR.amostra, size: 12 },
      error_x: { type: "data", symmetric: false, array: [hi - est], arrayminus: [est - lo], color: COR.amostra, thickness: 3, width: 10 },
      name: "Estimativa e IC", hovertemplate: "Estimativa: %{x:.3f}<br>IC: [" + lo.toFixed(3) + "; " + hi.toFixed(3) + "]<extra></extra>" },
    { type: "scatter", mode: "lines", x: [null], y: [null], name: "Parâmetro da população", line: { color: COR.populacao, width: 2 } },
    { type: "scatter", mode: "lines", x: [null], y: [null], name: "Valor de H0", line: { color: "#555", width: 2, dash: "dash" } },
  ], { title: { text: `${r.curto} — IC de ${Math.round(confianca * 100)}%${ehProporcao(r) ? " (em %)" : " (" + r.unidade + ")"}`, font: { size: 13 } },
    margin: { ...MARGEM, t: 60, l: 70 }, shapes: [linha(par, COR.populacao, "solid"), linha(ref, "#555", "dash")],
    legend: { orientation: "h", y: -0.3 }, height: 280 }, CONFIG_PLOTLY);
}

function tabelaComparacao(resultados, confianca) {
  const linhas = resultados.map((r) => `<tr><td>${r.titulo}</td><td>${valor(r, r.parametro)}</td><td>${valor(r, r.estimativa)}</td>
    <td>${valor(r, r.estimativa - r.parametro)}</td><td>${valor(r, r.ep)}</td>
    <td>[${valor(r, r.ic[0])}; ${valor(r, r.ic[1])}]</td><td>${r.ic_contem_parametro ? "Sim" : "Não"}</td></tr>`);
  document.getElementById("comparacao").innerHTML = `<table><thead><tr><th>Parâmetro</th><th>População (calculado)</th>
    <th>Amostra (estimativa pontual)</th><th>Diferença</th><th>Erro-padrão</th><th>IC de ${Math.round(confianca * 100)}%</th>
    <th>IC contém o parâmetro?</th></tr></thead><tbody>${linhas.join("")}</tbody></table>`;
}

function cartaoTeste(r) {
  const s = simbolo(r), ref = ehProporcao(r) ? fmt(r.ref, 2) : fmt(r.ref, 0);
  const erro = r.avaliacao.startsWith("Erro");
  return `<div class="teste"><h3>${r.titulo}</h3><p class="nota">${r.justificativa}</p>
    <dl><dt>Hipóteses</dt><dd>H0: ${s} = ${ref} &nbsp; vs &nbsp; H1: ${s} ${SIMBOLO_H1[r.h1]} ${ref}</dd>
    <dt>Nível de significância</dt><dd>α = ${fmt(r.alfa, 2)}</dd>
    <dt>Estimativa amostral</dt><dd>${valor(r, r.estimativa)} (n = ${fmtInt(r.n)})</dd>
    <dt>Estatística de teste</dt><dd>${r.estat_nome} = ${fmt(r.estat, 3)}</dd>
    <dt>Valor-p</dt><dd>${fmtP(r.p_valor)}</dd>
    <dt>Decisão</dt><dd><span class="selo ${r.rejeita ? "rejeita" : "mantem"}">${r.rejeita ? "Rejeita H0" : "Não rejeita H0"}</span></dd>
    <dt>Valor na população</dt><dd>${valor(r, r.parametro)}</dd></dl>
    <div class="avaliacao ${erro ? "erro" : ""}">${r.avaliacao}</div>
    <p class="nota"><strong>Condições:</strong> ${r.condicoes}</p></div>`;
}

function desenharSimulacao() {
  const s = DADOS.simulacao, ordem = s.intervalos.map((_, i) => i + 1);
  const contem = s.intervalos.map(([lo, , hi]) => lo <= s.parametro && s.parametro <= hi);
  const traco = (ok, nome, cor) => {
    const idx = ordem.filter((_, i) => contem[i] === ok);
    return { type: "scatter", mode: "markers", name: nome, x: idx, y: idx.map((i) => s.intervalos[i - 1][1]), marker: { color: cor, size: 5 },
      error_y: { type: "data", symmetric: false, array: idx.map((i) => s.intervalos[i - 1][2] - s.intervalos[i - 1][1]),
        arrayminus: idx.map((i) => s.intervalos[i - 1][1] - s.intervalos[i - 1][0]), color: cor, thickness: 1.5, width: 0 } };
  };
  Plotly.react("simulacao", [traco(true, "IC contém a média populacional", COR.ok), traco(false, "IC não contém", COR.erro)],
    { margin: MARGEM, xaxis: { title: "Amostra simulada (cada uma com n = " + fmtInt(DADOS.meta.n) + ")" }, yaxis: { title: "Renda média (R$)" },
      shapes: [{ type: "line", x0: 0, x1: s.total + 1, y0: s.parametro, y1: s.parametro, line: { color: COR.populacao, width: 2 } }],
      legend: { orientation: "h", y: -0.2 } }, CONFIG_PLOTLY);
  document.getElementById("texto-simulacao").innerHTML = `Foram sorteadas ${s.total} amostras aleatórias simples do mesmo tamanho e, em cada uma,
    calculado o IC de 95% para a renda média. A linha azul é a média da população (R$ ${fmt(s.parametro)}).
    <strong>${s.cobertos} dos ${s.total} intervalos contêm o parâmetro</strong>. O esperado seria perto de 95; a renda é muito assimétrica,
    com poucos valores extremamente altos, o que alarga a variabilidade da média e tende a reduzir a cobertura real do intervalo.`;
}

function interpretar(resultados, confianca) {
  const dentro = resultados.filter((r) => r.ic_contem_parametro).length;
  const erros = resultados.filter((r) => r.avaliacao.startsWith("Erro"));
  const itens = [
    `As estimativas pontuais ficaram próximas dos parâmetros, mas nenhuma coincide exatamente: a diferença é o erro amostral, esperado em qualquer amostra.`,
    `${dentro} dos ${resultados.length} intervalos de ${Math.round(confianca * 100)}% contêm o parâmetro populacional. Um intervalo de confiança não garante acerto em uma amostra específica: o nível de confiança descreve a frequência de acerto do método em amostras repetidas.`,
    `A renda tem o intervalo relativamente mais largo porque sua variabilidade é muito maior (desvio-padrão acima da média); proporções e horas são estimadas com mais precisão para o mesmo n.`,
    erros.length
      ? `Decisão que não coincide com a população: ${erros.map((r) => `<strong>${r.titulo}</strong> — ${r.avaliacao}`).join("; ")} Não rejeitar H0 não prova que H0 é verdadeira: diferenças pequenas exigem amostras maiores para serem detectadas (poder do teste).`
      : `Neste nível de significância, todas as decisões dos testes coincidem com o que se observa na população.`,
    `Limitações: (1) a "população" é o conjunto de registros do arquivo da PNAD Contínua, sem pesos amostrais, portanto as conclusões não se estendem ao Brasil; (2) a análise cobre apenas pessoas ocupadas com renda e horas informadas; (3) a renda é declarada e muito assimétrica, o que torna a média sensível a valores extremos; (4) outra semente de sorteio produziria estimativas, intervalos e possivelmente decisões diferentes.`,
  ];
  document.getElementById("interpretacao").innerHTML = itens.map((t) => `<li>${t}</li>`).join("");
}

function atualizar() {
  const chave = document.getElementById("confianca").value, confianca = Number(chave);
  const resultados = DADOS.inferencia[chave];
  document.getElementById("ic").innerHTML = resultados.map((r) => `<div id="ic-${r.id}" class="grafico"></div>`).join("");
  resultados.forEach((r) => desenharIntervalo(r, confianca));
  tabelaComparacao(resultados, confianca);
  document.getElementById("testes-proporcao").innerHTML = resultados.filter(ehProporcao).map(cartaoTeste).join("");
  document.getElementById("testes-media").innerHTML = resultados.filter((r) => !ehProporcao(r)).map(cartaoTeste).join("");
  interpretar(resultados, confianca);
}

montarNavegacao("inferencia.html");
document.querySelectorAll("#N").forEach((e) => (e.textContent = fmtInt(DADOS.meta.N)));
document.querySelectorAll("#n").forEach((e) => (e.textContent = fmtInt(DADOS.meta.n)));
document.getElementById("confianca").addEventListener("change", atualizar);
atualizar();
desenharSimulacao();
