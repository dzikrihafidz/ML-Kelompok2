# ML-Kelompok2
Proyek mata kuliah Machine Learning minggu 2

# Smart ML - Combined Cycle Power Plant

Proyek Machine Learning terintegrasi menggunakan dataset
Combined Cycle Power Plant (CCPP).

## Tim

| Nama | Peran |
|---|---|
| Dzikri | Koordinator |
| Faiz | Data Engineer |
| Mack | ML Engineer 1 |
| Farel | ML Engineer 2 |
| Luthfi | Backend & Frontend |

## Dataset

Combined Cycle Power Plant (CCPP).

## Struktur Project

- `data/` : dataset
- `notebooks/` : notebook analisis
- `src/` : source code preprocessing
- `models/` : model Machine Learning
- `app/` : aplikasi web
- `tests/` : pengujian

Dataset digunakan untuk menganalisis hubungan antara kondisi lingkungan
dan electrical power output pada Combined Cycle Power Plant.

Sumber data menyediakan 9.568 data point dengan lima variabel:

| Variabel | Keterangan |
|---|---|
| AT | Ambient Temperature |
| V | Exhaust Vacuum |
| AP | Ambient Pressure |
| RH | Relative Humidity |
| PE | Electrical Power Output |

File sumber disimpan pada:

`data/raw/Folds5x2_pp.xlsx`