/**
 * Statistical helpers for the LIQD Mines simulation + verify steps.
 * Chi-squared p-values via exact regularized incomplete gamma.
 */

export function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < k; i++) {
    c = (c * (n - i)) / (i + 1);
  }
  return c;
}

export function regularizedGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  const gln = logGamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  } else {
    let b = x + 1 - a;
    let c = 1 / 1e-300;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-14) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
  }
}

export function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

export function chiSquaredPValue(chiSq: number, df: number): number {
  return 1 - regularizedGamma(df / 2, chiSq / 2);
}

export interface ChiSquaredResult {
  chi2: number;
  df: number;
  pValue: number;
}

export function chiSquaredTest(observed: number[], expected: number[]): ChiSquaredResult {
  if (observed.length !== expected.length) throw new Error('length mismatch');
  // POOLING RULE, STATED EXACTLY — because two independent reviewers rebuilt Pass 2 from the
  // report's chapters and matched 0 of 138 rows, then matched 138/138 only after reading this
  // function. The rule is NOT "pool every cell with expected < 5". It is: walk inward from the
  // FRONT while the leading expected is < 5, then inward from the BACK while the trailing
  // expected is < 5, and stop. Interior cells are never touched.
  //
  // At Pass-2 (n=50 first-draws over GRID=25 cells, expected 2.0 in every cell) that yields:
  //     pooled expected vector [6, 2×19, 6]  →  21 cells, df = 20
  // i.e. the two ends absorb two neighbours each and NINETEEN interior cells stay at expected 2.
  // An outside reader who pools all sub-5 cells, or who does not pool at all (df = 24), gets a
  // different statistic and cannot reproduce a single published earlyChi2. rtp-analysis.md,
  // findings.md F17 and the glossary now describe this rule; keep them in step with this code.
  //
  // It is sound in Pass 2 because the SAME pooling is applied identically to every bootstrap
  // replicate and to the observed value, so the empirical p-value stays valid regardless of the
  // pooling rule (FIX-5). It is the reproducibility of the number, not its validity, that the
  // under-description cost us.
  const obs = [...observed];
  const exp = [...expected];
  while (obs.length > 2 && exp[0] < 5) {
    obs[1] += obs[0]; exp[1] += exp[0]; obs.shift(); exp.shift();
  }
  while (obs.length > 2 && exp[exp.length - 1] < 5) {
    const n = obs.length;
    obs[n - 2] += obs[n - 1]; exp[n - 2] += exp[n - 1]; obs.pop(); exp.pop();
  }
  let chi2 = 0;
  for (let i = 0; i < obs.length; i++) {
    if (exp[i] > 0) chi2 += (obs[i] - exp[i]) ** 2 / exp[i];
  }
  const df = obs.length - 1;
  return { chi2, df, pValue: chiSquaredPValue(chi2, df) };
}

export function lag1Autocorrelation(series: number[]): number {
  const n = series.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += series[i];
  mean /= n;
  let num = 0, den = 0;
  for (let i = 0; i < n - 1; i++) num += (series[i] - mean) * (series[i + 1] - mean);
  for (let i = 0; i < n; i++) den += (series[i] - mean) ** 2;
  return den === 0 ? 0 : num / den;
}

export interface RunsTestResult {
  runs: number;
  expected: number;
  z: number;
  pValue: number;
}

export function runsTest(series: number[]): RunsTestResult {
  const n = series.length;
  let n1 = 0, runs = 1;
  let prev = series[0];
  if (prev === 1) n1++;
  for (let i = 1; i < n; i++) {
    if (series[i] === 1) n1++;
    if (series[i] !== prev) { runs++; prev = series[i]; }
  }
  const n2 = n - n1;
  const expected = (2 * n1 * n2) / n + 1;
  const varRuns = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
  const z = varRuns > 0 ? (runs - expected) / Math.sqrt(varRuns) : 0;
  const pValue = normalTwoSidedP(z);   // ONE expression, shared with the verifier's reconciliation
  return { runs, expected, z, pValue };
}

export function inverseCriticalZ(alpha: number): number {
  const p = alpha / 2;
  const t = Math.sqrt(-2 * Math.log(p));
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Two-sided standard-normal tail, `2·(1 − Φ(|z|))` — the SAME expression `runsTest` above uses
 * to turn its z into a p-value, exported so a verifier can RECONCILE a stored runs p-value
 * against its own stored z instead of taking both on faith.
 *
 * Why that matters (QA 2026-09-09, reviewer counterexample H-C): a simulation artifact carries
 * a statistic AND its p-value as two independent numbers. Nothing checked that they described
 * the same event, so `firstDrawChi2 = 500` alongside `firstDrawPValue = 0.7787` scored
 * `[PASS] Step 16` and 21/21 Full Pass — a χ² of 500 on 24 df has p ≈ 1e-89. Every
 * statistic/p-value pair in the artifact is now recomputed from its own partner; this is the
 * helper for the runs leg. It must stay bit-identical to `runsTest`'s own line, so both call it.
 */
export function normalTwoSidedP(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return Math.sign(x) * y;
}
