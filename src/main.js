// Stoichiometry + simple balloon circumference visualization.
// Balloon "max circumference" is based on a proxy radius derived from CO2 moles.
// Molar masses (g/mol)
const M = {
  citric: 192.12,   // C6H8O7
  Li2CO3: 73.89,
  Na2CO3: 105.99
};

// UI helpers
const $ = (id) => document.getElementById(id);

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function molesFromGrams(massG, molarMass) {
  const m = Number(massG);
  if (!isFinite(m) || m < 0) return 0;
  return m / molarMass;
}

// Chemistry model
function computeCO2({ nCitricPer15mL, liMassG, naMassG }) {
  const nLi = molesFromGrams(liMassG, M.Li2CO3);
  const nNa = molesFromGrams(naMassG, M.Na2CO3);

  // Carbonates provide carbonate ions
  const nCO3 = nLi + nNa;

  // Triprotic citric acid: 1 mol citric gives 3 mol-equivalents H+
  const nHplusEq = 3 * nCitricPer15mL;

  // Each CO3 needs 2 H+ equivalents to produce 1 CO2
  const nCO2 = Math.min(nCO3, nHplusEq / 2);

  return { nLi, nNa, nCO3, nHplusEq, nCO2 };
}

// Balloon mapping
// We use V = kV * nCO2 and then r = V^(1/3). Then C = 2πr.
// To express circumference in "cm", we treat the resulting r units as cm via scaling.
function computeCircumferenceCm(nCO2, kV) {
  const V = kV * Math.max(0, nCO2);
  const r = Math.pow(V, 1/3); // visualization proxy
  const C = 2 * Math.PI * r; // "cm" by convention in this sim
  return { V, r, C };
}

// Render balloon as an ellipse with radius r mapped to SVG scale.
function renderBalloon(svgEl, progress01, targetR) {
  // Clear
  svgEl.innerHTML = "";

  // Base positions
  const cx = 130;
  const cy = 92;

  // Map r (cm proxy) to pixels, adjusted for the 260x220 viewBox
  const pxPerCm = 350; 
  const rPx = targetR * pxPerCm * progress01;

  // Safety minimum
  const rp = Math.max(1, rPx);

  // Balloon body
  const body = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  body.setAttribute("cx", cx);
  body.setAttribute("cy", cy);
  body.setAttribute("rx", rp);
  body.setAttribute("ry", rp * 1.05);
  body.setAttribute("fill", "rgba(93,214,255,0.25)");
  body.setAttribute("stroke", "rgba(93,214,255,0.85)");
  body.setAttribute("stroke-width", 2);
  svgEl.appendChild(body);

  // Shine highlight
  const shine = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  shine.setAttribute("cx", cx - rp * 0.2);
  shine.setAttribute("cy", cy - rp * 0.15);
  shine.setAttribute("rx", rp * 0.35);
  shine.setAttribute("ry", rp * 0.35);
  shine.setAttribute("fill", "rgba(255,255,255,0.22)");
  svgEl.appendChild(shine);

  // Knot / string
  const knotY = cy + rp * 1.0;
  const knot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  knot.setAttribute("cx", cx);
  knot.setAttribute("cy", knotY + 4);
  knot.setAttribute("r", Math.max(2, rp * 0.05));
  knot.setAttribute("fill", "rgba(230,240,255,0.9)");
  svgEl.appendChild(knot);

  const string = document.createElementNS("http://www.w3.org/2000/svg", "path");
  string.setAttribute("d", `M ${cx} ${knotY + 6} C ${cx - rp*0.15} ${knotY + 30}, ${cx + rp*0.15} ${knotY + 50}, ${cx} 210`);
  string.setAttribute("stroke", "rgba(230,240,255,0.55)");
  string.setAttribute("stroke-width", 2);
  string.setAttribute("fill", "none");
  svgEl.appendChild(string);
}

// Animate with requestAnimationFrame
function animateBalloon(svgEl, targetR, gradual) {
  const duration = gradual ? 2400 : 0;
  const start = performance.now();

  function frame(now) {
    const t = duration === 0 ? 1 : clamp((now - start) / duration, 0, 1);
    renderBalloon(svgEl, t, targetR);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function syncSliderAndNumber(rangeId, numId) {
  const rangeEl = $(rangeId);
  const numEl = $(numId);

  const setFromRange = () => {
    numEl.value = Number(rangeEl.value).toFixed(2);
    updateReadouts();
  };
  const setFromNum = () => {
    const v = clamp(Number(numEl.value), Number(rangeEl.min), Number(rangeEl.max));
    rangeEl.value = v.toFixed(2);
    numEl.value = v.toFixed(2);
    updateReadouts();
  };

  rangeEl.addEventListener("input", setFromRange);
  numEl.addEventListener("input", setFromNum);
}

// Tube configuration
const tubes = [
  { type: 'li', range: "liG1", num: "liG1_num", svg: "svg1", circ: "circ_1" },
  { type: 'li', range: "liG2", num: "liG2_num", svg: "svg2", circ: "circ_2" },
  { type: 'na', range: "naG3", num: "naG3_num", svg: "svg3", circ: "circ_3" },
  { type: 'na', range: "naG4", num: "naG4_num", svg: "svg4", circ: "circ_4" }
];

function updateReadouts() {
  const nCitric = Number($("citricMol").value);
  const safeNC = isFinite(nCitric) && nCitric > 0 ? nCitric : 0;

  const kV = Number($("kV").value);
  const safeKV = isFinite(kV) && kV > 0 ? kV : 0;

  tubes.forEach((t) => {
    const massG = Number($(t.range).value);

    const liMassG = t.type === 'li' ? massG : 0;
    const naMassG = t.type === 'na' ? massG : 0;

    const { nCO2 } = computeCO2({
      nCitricPer15mL: safeNC,
      liMassG,
      naMassG
    });

    const { C, r } = computeCircumferenceCm(nCO2, safeKV);
    $(t.circ).textContent = `${C.toFixed(2)} cm`;

    // Render preview preview
    renderBalloon($(t.svg), 1, r);
  });
}

function runReaction() {
  const gradual = $("gradual").checked;
  const nCitric = Number($("citricMol").value);
  const safeNC = isFinite(nCitric) && nCitric > 0 ? nCitric : 0;

  const kV = Number($("kV").value);
  const safeKV = isFinite(kV) && kV > 0 ? kV : 0;

  tubes.forEach((t) => {
    const massG = Number($(t.range).value);
    const liMassG = t.type === 'li' ? massG : 0;
    const naMassG = t.type === 'na' ? massG : 0;

    const { nCO2 } = computeCO2({
      nCitricPer15mL: safeNC,
      liMassG,
      naMassG
    });

    const { C, r } = computeCircumferenceCm(nCO2, safeKV);

    // Animate
    animateBalloon($(t.svg), r, gradual);

    $(t.circ).textContent = `${C.toFixed(2)} cm`;
  });
}

function resetAll() {
  $("liG1").value = "2.00"; $("liG1_num").value = "2.00";
  $("liG2").value = "0.00"; $("liG2_num").value = "0.00";

  $("naG3").value = "2.00"; $("naG3_num").value = "2.00";
  $("naG4").value = "1.00"; $("naG4_num").value = "1.00";

  $("citricMol").value = "0.04625";
  $("kV").value = "0.002";
  $("gradual").checked = false;

  updateReadouts();
}

function init() {
  // Bind all 4 slider/number pairs
  tubes.forEach(t => syncSliderAndNumber(t.range, t.num));

  $("runBtn").addEventListener("click", runReaction);
  $("resetBtn").addEventListener("click", resetAll);

  updateReadouts();
}

// Ensure DOM is fully loaded before running init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
