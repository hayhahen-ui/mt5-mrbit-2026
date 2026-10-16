# tools/ml — Phase B: dataset + retrain NN từ journal thật (P2-kaizen 16/10/2026)

## Hiện trạng dữ liệu (16/10/2026)

`build-dataset.py` đọc shared journal (nhánh `data`, 3 nhóm) → **86 mẫu hợp lệ < 100**
→ **cổng chặn, KHÔNG train** (đúng thiết kế Phase B). Win rate đo được: **39.5%**.

| Hạng mục | Số liệu |
|---|---|
| Events / trade events / trùng lặp loại bỏ | 374 / 223 / 137 |
| Mẫu hợp lệ (có nhãn rMultiple) | 86 |
| Khoảng thời gian | 10/10 → 16/10/2026 |
| Outcome | TIME 43, SL 26, TP 14, MANUAL 3 |

**Phát hiện chất lượng dữ liệu:** journal ghi trùng mỗi lệnh 2–3 lần (223 → 86 sau dedup).
Builder đã khử trùng theo `(symbol, direction, entry, exit, ts)`.

## Quy trình retrain (khi đủ ≥100 mẫu)

1. `python3 tools/ml/build-dataset.py --out dataset.json` → exit 0 nghĩa là đủ cổng.
2. Viết `train.py` (numpy): logistic regression như v0, features mở rộng từ builder
   (symbol, direction, session, hour_vn, dow_vn + feature giá khi có nến lịch sử).
3. **Đánh giá out-of-sample bắt buộc:** chia theo thời gian 60/20/20 (train/val/test),
   purge 15 phút quanh điểm cắt để chống leakage. Chỉ deploy khi test AUC > 0.55
   **và** profit factor trên nhãn rMultiple > 1.2.
4. Xuất weights JSON theo schema `src/data/neuralWeights.json`, bump `modelVersion`,
   giữ `featureVersion` đồng bộ với `src/lib/neural/contracts.ts`.
5. NN vẫn ở **shadow mode** cho đến khi user duyệt dùng điểm NN trong cổng (quy tắc Phase C).

## Cấm kỵ

- KHÔNG train dưới 100 mẫu (overfit chắc chắn với 8+ features).
- KHÔNG tune hyperparameter trên tập test.
- KHÔNG dùng nhãn proxy 4h khi đã có outcome thật (rMultiple).
- Giá trị thiếu → `null` kèm lý do (theo contracts.ts), **không** điền 0.
