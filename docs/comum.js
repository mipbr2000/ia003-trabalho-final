// Funções compartilhadas pelos três painéis.
const COR = { populacao: "#2563a8", amostra: "#d9722b", ok: "#1f8a4c", erro: "#b3261e" };
const NOME_BASE = { populacao: "População", amostra: "Amostra" };
const ROTULO = {
  renda: "Renda mensal habitual do trabalho (R$)", idade: "Idade (anos)", horas: "Horas habituais por semana",
  sexo: "Sexo", situacao: "Situação do domicílio", superior: "Ensino superior completo",
  instrucao: "Nível de instrução", cor: "Cor ou raça", regiao: "Grande região",
};
const CURTO = { renda: "Renda (R$)", idade: "Idade (anos)", horas: "Horas semanais", sexo: "Sexo", situacao: "Situação",
  superior: "Superior completo", instrucao: "Instrução", cor: "Cor ou raça", regiao: "Região" };
const CONFIG_PLOTLY = { responsive: true, displayModeBar: false };
const MARGEM = { l: 55, r: 15, t: 40, b: 50 };

const fmt = (v, casas = 2) =>
  v === null || v === undefined ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtInt = (v) => fmt(v, 0);
const fmtPct = (v, casas = 2) => fmt(v, casas) + "%";
const fmtP = (p) => (p < 0.0001 ? "< 0,0001" : fmt(p, 4));

function montarNavegacao(paginaAtual) {
  const paginas = [
    ["index.html", "Painel 1 — População"],
    ["amostra.html", "Painel 2 — Amostra"],
    ["inferencia.html", "Painel 3 — Inferência e comparação"],
  ];
  document.querySelector("nav").innerHTML = paginas
    .map(([href, nome]) => `<a href="${href}" class="${href === paginaAtual ? "ativo" : ""}">${nome}</a>`)
    .join("");
}
