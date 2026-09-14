#!/usr/bin/env python3
"""Replay the published Pass-2 bootstrap independently, using only Python's standard library.

The published dataset, simulation, provenance, and null statistics are read-only.
Only the report destination is written; by default it is under outputs/run/.
"""
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction
from bisect import bisect_left
from datetime import datetime, timezone
import argparse
import hashlib
import hmac
import json
import math
import struct
import time


VERSION = 'mines-seed-derivation-v1'


def check(condition, message):
    if not condition:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def derive(master, domain, index):
    message = f'{VERSION}:{domain}:{index}'.encode('utf-8')
    return hmac.digest(bytes.fromhex(master), message, 'sha256')[:16].hex()


def first_tile(server, client, nonce):
    cursor = 0
    limit = (2**32 // 25) * 25
    while True:
        digest = hmac.digest(bytes.fromhex(server), f'{client}:{nonce}:{cursor}'.encode('utf-8'), 'sha256')
        for offset in range(0, 32, 4):
            value = int.from_bytes(digest[offset:offset+4], 'big')
            if value < limit:
                return 1 + value % 25
        cursor += 1000000


def histogram_stat(freq, count):
    observed, expected = list(freq), [count/25]*25
    while len(observed)>2 and expected[0]<5:
        observed[1] += observed[0]
        expected[1] += expected[0]
        del observed[0], expected[0]
    while len(observed)>2 and expected[-1]<5:
        observed[-2] += observed[-1]
        expected[-2] += expected[-1]
        observed.pop()
        expected.pop()
    total = 0.0
    # Left-to-right IEEE-754 addition preserves the producer's exact >= tie comparison.
    for o, e in zip(observed, expected):
        total += (o-e)**2/e
    return total, len(observed)-1


def null_worker(args):
    master, mc, reps, early_n = args
    stats = []
    for rep in range(reps):
        server = derive(master, f'pass2-bootstrap-server:m={mc}', rep)
        client = derive(master, f'pass2-bootstrap-client:m={mc}', rep)
        freq = [0]*25
        for nonce in range(early_n):
            freq[first_tile(server, client, nonce)-1] += 1
        stats.append(histogram_stat(freq, early_n)[0])
    stats.sort()
    return mc, struct.pack('<'+'d'*len(stats), *stats)


def seed_worker(args):
    seed, early_n, nonces = args
    early, late = [0]*25, [0]*25
    for nonce in range(nonces):
        (early if nonce<early_n else late)[first_tile(seed['serverSeed'], seed['clientSeed'], nonce)-1] += 1
    early_chi, _ = histogram_stat(early, early_n)
    late_chi, df = histogram_stat(late, nonces-early_n)
    check(df == 24, 'The independent late-p formula requires 24 degrees of freedom')
    x = late_chi/2
    late_p = math.exp(-x)*math.fsum(x**j/math.factorial(j) for j in range(12))
    return {'epoch':seed['epoch'], 'hashedServerSeed':seed['hashedServerSeed'],
            'earlyChi2':early_chi, 'lateChi2':late_chi, 'latePValue':late_p}


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=root/'outputs/run/bootstrap-replay-report.json')
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    check(1 <= args.workers <= 8, '--workers must be between 1 and 8')
    started = time.monotonic()
    provenance_raw = (root/'outputs/simulation-provenance.json').read_bytes()
    provenance = json.loads(provenance_raw)
    dataset_path = root/'data/mines-master-6900bets.json'
    simulation_path = root/'outputs/simulation-results.json'
    null_path = root/'outputs/bootstrap-nulls.float64le'
    destination = args.out.resolve()
    inside_repo = root==destination or root in destination.parents
    run_dir = (root/'outputs/run').resolve()
    inside_run = run_dir in destination.parents
    check(not (inside_repo and destination.exists() and not inside_run),
          '--out cannot overwrite an existing repository file outside outputs/run/')
    raw, sim_raw, reference_null = dataset_path.read_bytes(), simulation_path.read_bytes(), null_path.read_bytes()
    check(sha(raw)==provenance['dataset']['sha256'], 'Dataset hash disagrees with provenance')
    check(sha(sim_raw)==provenance['simulation']['sha256'], 'Simulation hash disagrees with provenance')
    check(sha(reference_null)==provenance['pass2']['nullSHA256'], 'Retained null hash disagrees with provenance')
    ds, sim = json.loads(raw), json.loads(sim_raw)
    p2, inputs = sim['pass2_casino_seeds'], provenance['pass2']
    master = sim['masterSeed']
    check(isinstance(master,str) and 32<=len(master)<=128 and len(master)%2==0
          and all(c in '0123456789abcdef' for c in master), 'Invalid master seed')
    check(sim['seedDerivation']==p2['bootstrapSeedDerivation']==inputs['seedDerivation']==VERSION, 'Unsupported derivation version')
    check(master==inputs['masterSeed'], 'Master seed disagrees with provenance')
    check(inputs['serverDomain']=='pass2-bootstrap-server:m={mineCount}'
          and inputs['clientDomain']=='pass2-bootstrap-client:m={mineCount}'
          and inputs['derivedSeedBytes']==16, 'Seed derivation parameters disagree with implementation')
    for field in ['earlyWindow','lateWindow','noncesPerSeed']:
        check(p2[field]==inputs[field], f'{field} disagrees with provenance')
    reps, nonces = p2['bootstrapReps'], p2['noncesPerSeed']
    check(isinstance(reps,int) and reps>=1000 and reps==inputs['bootstrapRepsPerMineCount'], 'Invalid bootstrap replicate count')
    check(inputs['replicateIndex']==[0,reps-1], 'Replicate indices disagree with bootstrap count')
    check(p2['earlyWindow'][0]==0, 'Early window must start at nonce 0')
    early_n = p2['earlyWindow'][1]+1
    check(p2['lateWindow']==[early_n,nonces-1] and nonces-early_n>=125, 'Invalid nonce windows')
    seeds = [s for s in ds['seeds'] if s.get('serverSeed')]
    mine_counts = {}
    for bet in ds['bets']:
        mine_counts.setdefault(bet['hashedServerSeed'], bet['mineCount'])
    mcs = sorted(set(mine_counts[s['hashedServerSeed']] for s in seeds))
    check(mcs==p2['bootstrapMineCounts']==inputs['mineCounts'], 'Mine-count set disagrees with dataset')
    check(inputs['nullStatistics']==len(mcs)*reps, 'Null-statistic count disagrees with dimensions')
    check(len(reference_null)==len(mcs)*reps*8, 'Wrong retained null size')
    reference_rows = {r['hashedServerSeed']:r for r in p2['results']}
    check(len(reference_rows)==len(p2['results'])==len(seeds)==p2['seeds_tested'], 'Seed population mismatch')
    check(set(reference_rows)=={s['hashedServerSeed'] for s in seeds}, 'Seed identities mismatch')
    nulls, hashes = {}, {}
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        for mi, (mc,binary) in enumerate(pool.map(null_worker, [(master,mc,reps,early_n) for mc in mcs])):
            offset = mi*reps*8
            check(binary==reference_null[offset:offset+reps*8], f'Bootstrap statistic mismatch at mine count {mc}')
            nulls[mc] = struct.unpack('<'+'d'*reps, binary)
            hashes[str(mc)] = sha(binary)
            print(f'Mine count {mc}: {reps:,} bootstrap statistics matched exactly', flush=True)
        actual_rows = list(pool.map(seed_worker, [(seed,early_n,nonces) for seed in seeds]))
    max_late_error = 0.0
    flags, comparisons = [], []
    for actual in actual_rows:
        ref = reference_rows[actual['hashedServerSeed']]
        mc = mine_counts[actual['hashedServerSeed']]
        check(actual['epoch']==ref['epoch'] and mc==ref['mineCount'], 'Row identity mismatch')
        check(actual['earlyChi2']==ref['earlyChi2'] and actual['lateChi2']==ref['lateChi2'], f'Chi-square mismatch at epoch {actual["epoch"]}')
        p = (reps-bisect_left(nulls[mc],actual['earlyChi2'])+1)/(reps+1)
        check(p==ref['earlyBootstrapP'], f'Bootstrap p-value mismatch at epoch {actual["epoch"]}')
        error = abs(actual['latePValue']-ref['latePValue'])
        max_late_error = max(max_late_error,error)
        check(error<1e-10, f'Late p-value mismatch at epoch {actual["epoch"]}')
        flag = p<.05 and actual['latePValue']>=.05
        check(flag==ref['cherryPickFlag'], f'Flag mismatch at epoch {actual["epoch"]}')
        if flag:
            flags.append(actual['epoch'])
        comparisons.append({'epoch':actual['epoch'], 'mineCount':mc, 'earlyBootstrapP':p, 'flag':flag})
    p = Fraction(19,400)
    n, k = len(seeds), len(flags)
    survival = float(sum((Fraction(math.comb(n,i))*p**i*(1-p)**(n-i) for i in range(k,n+1)),Fraction(0)))
    check(k==p2['cherryPickFlags'], 'Flag-count mismatch')
    check(abs(n*float(p)-p2['expectedFlagsByChance'])<1e-12, 'Nominal expected-flags mismatch')
    check(abs(survival-p2['cherryPickSurvivalP'])<1e-12, 'Nominal binomial-survival mismatch')
    report = {'generatedAt':datetime.now(timezone.utc).isoformat(), 'method':'EXECUTED: independent Python standard-library implementation; no repository-code imports',
              'datasetSha256':sha(raw), 'simulationSha256':sha(sim_raw), 'provenanceSha256':sha(provenance_raw),
              'masterSeed':master, 'seedDerivation':VERSION, 'bootstrapStatisticsChecked':len(mcs)*reps,
              'bootstrapStatisticMismatches':0, 'bootstrapPValuesChecked':n, 'bootstrapPValueMismatches':0,
              'casinoChiSquareRowsChecked':n, 'casinoChiSquareMismatches':0,
              'latePMethod':'df=24 survival: exp(-chi2/2) * sum((chi2/2)^j/j!, j=0..11)',
              'latePMaxAbsoluteDifference':max_late_error, 'flagEpochs':flags,
              'nominalBinomialSurvival':survival, 'nullSha256':sha(reference_null), 'nullHashes':hashes,
              'results':comparisons, 'seconds':time.monotonic()-started, 'verdict':'PASS'}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(report,indent=2)+'\n')
    print(f'PASS: {len(mcs)*reps:,} bootstrap statistics and {n}/{n} early p-values reproduced; {k} flagged seeds.')
    print(f'Report: {args.out}')


if __name__=='__main__':
    main()
