// test-pnl-xauusd.ts — regression bug 14/10: P&L XAUUSD bị đánh giá thấp 100 lần
// khiến cắt-lỗ-sớm -$2 không bao giờ kích hoạt (lệnh thật -$15.66 mới đóng).
// Chạy: node --loader ./ts-resolve-loader.mjs test-pnl-xauusd.ts
import { livePnlUsd, entryPnlUsd, usdPerPipPerLot } from './src/lib/account.ts';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', name, extra ?? ''); }
};
const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;

// Lệnh lỗi thật trong ảnh: XAUUSD BUY 0.02, vào 4161.3, thoát 4153.47 → -$15.66
ok('XAUUSD thoát 4153.47 = -15.66', eq(livePnlUsd('XAUUSD', 'BUY', 4161.3, 4153.47, 0.02), -15.66), livePnlUsd('XAUUSD', 'BUY', 4161.3, 4153.47, 0.02));
// Ngưỡng cắt-lỗ-sớm -$2: giá 4160.3 → đúng -$2.00 → bot PHẢI kích hoạt
ok('XAUUSD giá 4160.3 = -2.00 (ngưỡng SL)', eq(livePnlUsd('XAUUSD', 'BUY', 4161.3, 4160.3, 0.02), -2.00), livePnlUsd('XAUUSD', 'BUY', 4161.3, 4160.3, 0.02));
// Ngưỡng ăn-non +$5: giá 4163.8 → +$5.00
ok('XAUUSD giá 4163.8 = +5.00 (ngưỡng TP)', eq(livePnlUsd('XAUUSD', 'BUY', 4161.3, 4163.8, 0.02), 5.00));
// SELL chiều ngược
ok('XAUUSD SELL 4161.3→4153.47 = +15.66', eq(livePnlUsd('XAUUSD', 'SELL', 4161.3, 4153.47, 0.02), 15.66));
// Khớp entryPnlUsd (sổ) — 3 công thức phải đồng nhất
const e: any = { symbol: 'XAUUSD', direction: 'BUY', entryPrice: 4161.3, exitPrice: 4153.47, lot: 0.02 };
ok('livePnlUsd khớp entryPnlUsd (XAUUSD)', eq(livePnlUsd('XAUUSD', 'BUY', 4161.3, 4153.47, 0.02), entryPnlUsd(e)));
// usdPerPipPerLot XAUUSD = $10 (không còn $0.1)
ok('usdPerPipPerLot XAUUSD = 10', usdPerPipPerLot('XAUUSD', 4161.3) === 10, usdPerPipPerLot('XAUUSD', 4161.3));

// Regression các mã khác (không được đổi hành vi):
ok('EURUSD 1.0 lot 10 pip = $100', eq(livePnlUsd('EURUSD', 'BUY', 1.1, 1.101, 1.0), 100));
ok('USDJPY khớp entryPnlUsd', eq(
  livePnlUsd('USDJPY', 'BUY', 158.0, 158.5, 0.01),
  entryPnlUsd({ symbol: 'USDJPY', direction: 'BUY', entryPrice: 158.0, exitPrice: 158.5, lot: 0.01 } as any)
));
ok('BTCUSD 0.01 lot +$100 = +$1', eq(livePnlUsd('BTCUSD', 'BUY', 60000, 60100, 0.01), 1.00));
ok('US30 khớp entryPnlUsd', eq(
  livePnlUsd('US30', 'BUY', 42000, 42100, 0.1),
  entryPnlUsd({ symbol: 'US30', direction: 'BUY', entryPrice: 42000, exitPrice: 42100, lot: 0.1 } as any)
));

console.log(`\n${pass}/${pass + fail} pass${fail ? `, ${fail} FAIL` : ''}`);
process.exit(fail ? 1 : 0);
