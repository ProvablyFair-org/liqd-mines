/**
 * The RTP-convergence page (outputs/rtp-convergence.html) — one renderer, two callers.
 *
 *   src/simulate.ts     renders it at the end of a simulation run, from the run's Pass-1 rows.
 *   src/write-chart.ts  renders it from the COMMITTED outputs/simulation-results.json, so the page
 *                       can be rebuilt (and checked) without drawing a single new seed.
 *
 * Every data point on the page is derived from the Pass-1 rows' `convergence` checkpoints
 * ({ n, wins } per mineCount) plus the exact k=1 multiplier from src/config.ts. Nothing else.
 *
 * SELF-CONTAINED (Framework 1.0 review, F16). Chart.js 4.4.7 is inlined verbatim, license banner
 * included, from the exact-version devDependency whose integrity package-lock.json pins. The page
 * fetches nothing at runtime. The library bytes are additionally SHA-256 pinned here, so a
 * different build under the same version string cannot slip into the artifact of record.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';

import { GRID, theoreticalRTP } from './config';

/** Sample points for the RTP-convergence chart (cumulative, per config), before the rounds cap. */
export const CONVERGENCE_SAMPLES_ALL = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];

/** The sample points a run of `roundsPerConfig` rounds per config records. */
export const convergenceSamples = (roundsPerConfig: number): number[] =>
  CONVERGENCE_SAMPLES_ALL.filter((n) => n <= roundsPerConfig);

/** Chart.js as shipped by the npm tarball chart.js@4.4.7 (dist/chart.umd.js — already minified). */
export const CHART_JS_FILE = path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
export const CHART_JS_VERSION = '4.4.7';
export const CHART_JS_SHA256 = '2812cb8825fdc57469eb2f7bb055e9429244e599920511ee477e828499b632cb';

/** Reads the pinned Chart.js build. Throws if it is absent or is not the pinned bytes. */
export function loadChartJs(file: string = CHART_JS_FILE): string {
  if (!fs.existsSync(file)) {
    throw new Error(`${path.relative(path.join(__dirname, '..'), file)} is missing — run \`npm ci\` (chart.js@${CHART_JS_VERSION} is a devDependency)`);
  }
  const bytes = fs.readFileSync(file);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== CHART_JS_SHA256) {
    throw new Error(`chart.js build hashes to ${sha}, not the pinned chart.js@${CHART_JS_VERSION} ${CHART_JS_SHA256}`);
  }
  const src = bytes.toString('utf8');
  if (/<\/script/i.test(src)) throw new Error('chart.js source contains "</script" — it cannot be inlined verbatim');
  return src;
}

export interface ConvergenceRow {
  mineCount: number;
  convergence: Array<{ n: number; wins: number }>;
}

export interface ConvergenceInput {
  /** Number of mineCount configurations in the run. */
  configCount: number;
  roundsPerConfig: number;
  /** Cumulative sample sizes to plot. */
  samples: number[];
  results: ConvergenceRow[];
}

export interface ConvergencePoint { n: number; rtp: number; se: number }

/**
 * Pooled k=1 RTP across all configs at each sample size, with its Standard Error.
 * SE = sigma/sqrt(n) (Standard ERROR, not standard deviation) per the audit standard.
 */
export function convergenceSeries(input: ConvergenceInput): ConvergencePoint[] {
  return input.samples.map((n) => {
    // pooled RTP = mean over configs of (winRate_m(n) * multiplier(m,1)); each config
    // contributes equal weight. Variance of a single round's payout for config m is
    // p(1-p)*mult^2; pooled SE uses the mean of per-config variances / (configs * n).
    let sumRTP = 0, sumVar = 0, k = 0;
    for (const r of input.results) {
      const cp = r.convergence.find((c) => c.n === n);
      if (!cp) continue;
      const p = cp.wins / n;
      // exact k=1 payout multiplier for this config: theoreticalRTP = winProb × mult
      const winProb = (GRID - r.mineCount) / GRID;
      const m1 = theoreticalRTP(r.mineCount, 1) / winProb;
      sumRTP += p * m1;
      sumVar += p * (1 - p) * m1 * m1;
      k++;
    }
    const meanRTP = k ? sumRTP / k : 0;
    const se = k ? Math.sqrt(sumVar / (k * k * n)) : 0;   // SE of the mean across configs
    return { n, rtp: meanRTP * 100, se: se * 100 };
  });
}

/** The page, byte for byte. `chartJs` is the library source to inline (see loadChartJs). */
export function renderConvergenceChart(input: ConvergenceInput, chartJs: string): string {
  const series = convergenceSeries(input);
  const finalConv = series.length ? series[series.length - 1] : { n: 0, rtp: 0, se: 0 };
  const configs = input.configCount;
  const rounds = input.roundsPerConfig;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>LIQD Mines — RTP Convergence (${configs} configs × ${rounds.toLocaleString()} rounds)</title>
<script>
${chartJs}<\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; padding: 24px; }
  .container { max-width: 1100px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e0e0e0; padding: 32px; }
  h1 { text-align: center; font-size: 16px; font-weight: 600; color: #333; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px; }
  .sub { text-align: center; font-size: 12px; color: #777; margin-bottom: 24px; }
  .chart-wrap { position: relative; height: 420px; }
  .final-box { display: inline-block; border: 2px solid #4caf50; border-radius: 8px; padding: 10px 20px; margin-top: 20px; }
  .final-box .label { font-size: 13px; color: #666; }
  .final-box .value { font-size: 22px; font-weight: 700; color: #2e7d32; }
  .legend { text-align: center; margin-top: 12px; font-size: 13px; color: #666; }
  .legend span { margin: 0 12px; }
  .legend .dot { display: inline-block; width: 12px; height: 3px; vertical-align: middle; margin-right: 4px; }
</style>
</head>
<body>
<div class="container">
  <h1>LIQD Mines — RTP Convergence</h1>
  <div class="sub">Pooled single-tile (k=1) RTP across all ${configs} mineCount configurations · fresh crypto-random seeds per config · band = ±2 &times; Standard Error (&sigma;/&radic;n)</div>
  <div class="chart-wrap"><canvas id="chart"></canvas></div>
  <div class="legend">
    <span><span class="dot" style="background:#1565c0"></span> Pooled simulated RTP</span>
    <span><span class="dot" style="background:rgba(229,115,115,0.5)"></span> &plusmn;2 SE band</span>
    <span><span class="dot" style="background:#e57373"></span> Theoretical 99.0000%</span>
  </div>
  <div style="text-align:right; margin-top:8px;">
    <div class="final-box">
      <span class="label">Final pooled RTP (${rounds.toLocaleString()} rounds/config):</span>
      <span class="value">${finalConv.rtp.toFixed(4)}%</span>
    </div>
  </div>
</div>
<script>
const data = ${JSON.stringify(series.map((d) => ({ x: d.n, y: d.rtp, se: d.se })))};
const theoretical = 99.0;
const labels = data.map(d => d.x >= 1e6 ? (d.x/1e6) + 'M' : (d.x/1e3) + 'K');
const ctx = document.getElementById('chart').getContext('2d');
new Chart(ctx, {
  type: 'line',
  data: { labels, datasets: [
    { label: 'Upper', data: data.map(d => d.y + 2*d.se), borderColor: 'transparent', backgroundColor: 'rgba(229,115,115,0.10)', fill: '+1', pointRadius: 0, tension: 0.3 },
    { label: 'Lower', data: data.map(d => d.y - 2*d.se), borderColor: 'transparent', backgroundColor: 'rgba(229,115,115,0.10)', fill: false, pointRadius: 0, tension: 0.3 },
    { label: 'Theoretical (99.0000%)', data: data.map(() => theoretical), borderColor: '#e57373', borderWidth: 2, borderDash: [8,4], fill: false, pointRadius: 0 },
    { label: 'Pooled RTP', data: data.map(d => d.y), borderColor: '#1565c0', borderWidth: 2.5, fill: false, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#1565c0', tension: 0.3 },
  ] },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: {
        title: (items) => labels[items[0].dataIndex] + ' rounds per config',
        label: (item) => item.datasetIndex === 3
          ? 'Pooled RTP: ' + item.parsed.y.toFixed(4) + '% (\u00b12 SE: \u00b1' + (2*data[item.dataIndex].se).toFixed(4) + ')'
          : item.datasetIndex === 2 ? 'Theoretical: 99.0000%' : null,
      } },
    },
    scales: {
      x: { title: { display: true, text: 'Rounds per configuration', font: { size: 12 } } },
      y: { ticks: { callback: v => v.toFixed(2) + '%' } },
    },
  },
});
<\/script>
</body>
</html>`;
}
