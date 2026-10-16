#!/usr/bin/env python3
"""
build-dataset.py — P2 Phase B (16/10/2026): dataset builder cho retrain NN tu journal THAT.

Nguon: shared journal tren nhanh `data` (shared/<group>/log.jsonl) — su kien position
dong that (type='trade', outcome TP/SL/TIME/MANUAL, rMultiple that), khong phai proxy 4h.

Quy trinh:
  1. Tai 3 log shared tu GitHub (nhanh data).
  2. Dedup theo (symbol, direction, entry, exit, ts) — journal hien co event trung lap.
  3. Nhan: win = rMultiple > 0 (ket qua THAT, da tru phi theo cach app tinh).
  4. Features tai thoi diem vao lenh (khong lookahead):
       symbol, direction, session (Sydney/Tokyo/London/NewYork theo dung dinh nghia
       app — gio dia phuong cua tung san), hour_vn, dow_vn, entry.
  5. CONG 100 MAU (thiet ke vong Kaizen): duoi 100 -> KHONG train, chi bao cao.

Ghi chu trung thuc:
  - Cac feature gia (EMA20/ROC10/RSI14...) can nen lich su tai thoi diem vao lenh,
    hien chua co nguon lich su intraday cho XAUUSD/forex -> de trong, KHONG bia.
  - Khi du 100+ mau: chay train.py (numpy) roi danh gia out-of-sample theo thoi gian.

Chay: python3 tools/ml/build-dataset.py [--out dataset.json]
"""
import json
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

REPO = "hayhahen-ui/mt5-mrbit-2026"
GROUPS = ["NX-COM7C", "NX-DEPK0", "NX-WSAPH"]
MIN_SAMPLES = 100  # cong toi thieu theo thiet ke Phase B

# Dinh nghia phien — mirror src/lib/sessions.ts
SESSIONS = [
    ("Sydney", "Australia/Sydney", 9, 17),
    ("Tokyo", "Asia/Tokyo", 9, 18),
    ("London", "Europe/London", 8, 17),
    ("New York", "America/New_York", 8, 17),
]
VN = timezone(timedelta(hours=7))


def sessions_at(ts_ms: int) -> list:
    dt_utc = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    out = []
    for label, tz, open_h, close_h in SESSIONS:
        local = dt_utc.astimezone(ZoneInfo(tz))
        h = local.hour + local.minute / 60
        if open_h <= h < close_h:
            out.append(label)
    return out


def fetch_log(group: str) -> list:
    url = f"https://raw.githubusercontent.com/{REPO}/data/shared/{group}/log.jsonl"
    req = urllib.request.Request(url, headers={"User-Agent": "mt5-mrbit-2026-p2"})
    events = []
    with urllib.request.urlopen(req, timeout=30) as r:
        for line in r.read().decode("utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return events


def main() -> int:
    out_path = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None

    events = []
    for g in GROUPS:
        try:
            events.extend(fetch_log(g))
        except Exception as e:  # noqa: BLE001 — bao loi tung nguon, khong chet ca builder
            print(f"[WARN] khong tai duoc {g}: {e}", file=sys.stderr)

    trades = [e for e in events if e.get("type") == "trade"]
    # Dedup: journal hien ghi trung 2-3 lan cho cung 1 lenh
    seen: dict = {}
    dups = 0
    for e in trades:
        k = (e.get("symbol"), e.get("direction"), e.get("entry"), e.get("exit"), e.get("ts"))
        if k in seen:
            dups += 1
        else:
            seen[k] = e
    uniq = list(seen.values())

    samples = []
    for e in uniq:
        r = e.get("rMultiple")
        if r is None:
            continue  # thieu nhan -> bo, khong doan
        ts = e["ts"]
        dt_vn = datetime.fromtimestamp(ts / 1000, tz=VN)
        sess = sessions_at(ts)
        samples.append({
            "ts": ts,
            "symbol": e.get("symbol"),
            "direction": e.get("direction"),
            "entry": e.get("entry"),
            "exit": e.get("exit"),
            "lot": e.get("lot"),
            "outcome": e.get("outcome"),
            "r_multiple": r,
            "label_win": 1 if r > 0 else 0,
            # features tai thoi diem vao (khong lookahead)
            "session": "+".join(sess) if sess else "Nghi",
            "hour_vn": dt_vn.hour,
            "dow_vn": dt_vn.weekday(),  # 0=Mon
        })
    samples.sort(key=lambda s: s["ts"])

    n = len(samples)
    wins = sum(s["label_win"] for s in samples)
    print("=== P2 dataset builder — journal THAT (shared log, nhanh data) ===")
    print(f"events: {len(events)} | trade events: {len(trades)} | trung lap loai bo: {dups}")
    print(f"mau hop le (co nhan rMultiple): {n}")
    if n:
        print(f"win rate (rMultiple>0): {100*wins/n:.1f}% ({wins}/{n})")
        print(f"symbol: {dict(Counter(s['symbol'] for s in samples))}")
        print(f"outcome: {dict(Counter(s['outcome'] for s in samples))}")
        print(f"session: {dict(Counter(s['session'] for s in samples))}")
        frm = datetime.fromtimestamp(samples[0]["ts"]/1000, tz=VN).strftime("%d/%m/%Y")
        to = datetime.fromtimestamp(samples[-1]["ts"]/1000, tz=VN).strftime("%d/%m/%Y")
        print(f"khoang thoi gian: {frm} -> {to}")

    if out_path:
        with open(out_path, "w") as f:
            json.dump({"min_samples_gate": MIN_SAMPLES, "n": n,
                       "samples": samples}, f, ensure_ascii=False)
        print(f"da ghi {out_path}")

    # CONG 100 MAU — duoi nguong thi DUNG, khong train
    if n < MIN_SAMPLES:
        print(f"\n[CONG] chi co {n} mau < {MIN_SAMPLES} -> KHONG train (theo thiet ke Phase B).")
        print("Can them journal: mo app, trade giay/tay hoac doi them du lieu that.")
        return 2
    print(f"\n[OK] du {n} mau >= {MIN_SAMPLES} -> co the chay train.py + danh gia out-of-sample.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
