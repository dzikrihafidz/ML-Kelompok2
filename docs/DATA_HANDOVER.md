# Data Engineering Handover
## Combined Cycle Power Plant

Dokumen ini berisi hasil akhir proses Data Engineering untuk dataset
Combined Cycle Power Plant (CCPP) sebelum digunakan oleh Machine
Learning Engineer.

---

## 1. Dataset

Nama dataset:
Combined Cycle Power Plant (CCPP)

File raw:
`data/raw/Folds5x2_pp.xlsx`

Dataset terdiri dari 9.568 observasi awal dengan 5 variabel.

---

## 2. Data Dictionary

| Kolom | Keterangan | Peran |
|---|---|---|
| AT | Ambient Temperature | Feature |
| V | Exhaust Vacuum | Feature |
| AP | Ambient Pressure | Feature |
| RH | Relative Humidity | Feature |
| PE | Electrical Power Output | Target |

Empat variabel pertama digunakan sebagai input.
PE digunakan sebagai target untuk supervised regression.

---

## 3. Data Validation

Hasil validasi awal:

- Jumlah baris awal: 9.568
- Jumlah kolom: 5
- Missing value: 0
- Infinite value: 0
- Duplicate identik: 41
- Kolom konstan: 0
- Seluruh variabel bertipe numerik

---

## 4. Data Cleaning

Sebanyak 41 baris duplicate identik dihapus.

Tidak dilakukan penghapusan kandidat outlier berdasarkan IQR,
karena belum terdapat bukti bahwa observasi tersebut merupakan
data invalid.

Jumlah data setelah cleaning:

**9.527 observasi**

File:

`data/processed/CCPP_clean.csv`

---

## 5. Train-Test Split

Untuk supervised learning:

- Training: 80%
- Testing: 20%
- Random state: 42

Training:

7.621 observasi

Testing:

1.906 observasi

File:

- `data/processed/CCPP_train.csv`
- `data/processed/CCPP_test.csv`

---

## 6. Preprocessing

Fitur input:

- AT
- V
- AP
- RH

Standardisasi menggunakan `StandardScaler`.

Regression scaler:
`models/regression_scaler.pkl`

Cluster scaler:
`models/cluster_scaler.pkl`

Regression scaler di-fit hanya menggunakan data training untuk
mencegah data leakage.

---

## 7. Feature Engineering

Baseline features:

- AT
- V
- AP
- RH

Candidate features:

- AT_squared
- AT_V_interaction
- AP_RH_ratio

Candidate features belum ditetapkan sebagai fitur final dan perlu
diuji oleh ML Engineer berdasarkan performa model.

---

## 8. Handover

### ML Engineer 1 - Regression

Gunakan:

- `data/processed/CCPP_train.csv`
- `data/processed/CCPP_test.csv`
- `models/regression_scaler.pkl`

Target:
`PE`

### ML Engineer 2 - Clustering

Gunakan:

- `AT`
- `V`
- `AP`
- `RH`

Scaler:
`models/cluster_scaler.pkl`

`PE` tidak digunakan sebagai input utama clustering dan dapat digunakan
setelah clustering untuk interpretasi karakteristik cluster.

---

## 9. Source Code

- `src/preprocessing.py`
- `src/feature_engineering.py`
- `src/validate_data_pipeline.py`