
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, render_template

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "processed" / "CCPP_clean.csv"

REQUIRED_COLUMNS = ["AT", "V", "AP", "RH", "PE"]


def load_dataset():
    """Membaca dataset aktual dan memvalidasi kolom yang diperlukan."""
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"File dataset tidak ditemukan: {DATA_PATH}"
        )

    df = pd.read_csv(DATA_PATH)

    missing_columns = [
        column
        for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Kolom dataset tidak lengkap: "
            + ", ".join(missing_columns)
        )

    return df


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "message": "Backend Flask berjalan"
    })


@app.route("/api/summary")
def dataset_summary():
    try:
        df = load_dataset()

        # Konversi kolom ke numerik agar statistik konsisten.
        selected_df = df[REQUIRED_COLUMNS].apply(
            pd.to_numeric,
            errors="coerce"
        )

        stats = selected_df.describe().round(2)

        return jsonify({
            "status": "ok",
            "dataset_name": "Combined Cycle Power Plant",
            "rows": int(len(df)),
            "columns": len(REQUIRED_COLUMNS),
            "features": REQUIRED_COLUMNS,
            "missing_values": int(
                selected_df.isna().sum().sum()
            ),
            "statistics": stats.to_dict()
        })

    except FileNotFoundError:
        return jsonify({
            "status": "error",
            "message": "File dataset tidak ditemukan."
        }), 404

    except ValueError as exc:
        return jsonify({
            "status": "error",
            "message": str(exc)
        }), 400

    except Exception:
        app.logger.exception("Gagal membaca dataset")
        return jsonify({
            "status": "error",
            "message": "Gagal memproses dataset."
        }), 500


@app.route("/api/visualizations")
def api_visualizations():
    """Menyediakan data CSV aktual untuk tiga grafik dashboard."""
    try:
        df = load_dataset()

        # Pastikan seluruh variabel visualisasi bertipe numerik.
        numeric_df = df[REQUIRED_COLUMNS].apply(
            pd.to_numeric,
            errors="coerce"
        )

        # Scatter plot hanya membutuhkan pasangan AT dan PE valid.
        scatter_df = numeric_df[["AT", "PE"]].dropna()

        if scatter_df.empty:
            return jsonify({
                "status": "error",
                "message": "Tidak ada data AT dan PE yang valid."
            }), 400

        # Korelasi dihitung menggunakan baris lengkap aktual.
        correlation_df = numeric_df.dropna(
            subset=REQUIRED_COLUMNS
        )

        if correlation_df.empty:
            return jsonify({
                "status": "error",
                "message": "Tidak ada baris lengkap untuk menghitung korelasi."
            }), 400

        correlation = correlation_df.corr()

        # Distribusi memakai seluruh nilai PE numerik yang tersedia.
        pe_values = numeric_df["PE"].dropna().tolist()

        if not pe_values:
            return jsonify({
                "status": "error",
                "message": "Tidak ada nilai PE yang valid."
            }), 400

        # at dan pe cocok dengan script.js yang sekarang.
        # x dan y disertakan sebagai alias untuk kompatibilitas.
        scatter_at = scatter_df["AT"].tolist()
        scatter_pe = scatter_df["PE"].tolist()

        return jsonify({
            "status": "ok",
            "dataset_name": "Combined Cycle Power Plant",
            "rows": int(len(numeric_df)),
            "scatter": {
                "at": scatter_at,
                "pe": scatter_pe,
                "x": scatter_at,
                "y": scatter_pe
            },
            "correlation": {
                "labels": REQUIRED_COLUMNS,
                "matrix": correlation.values.tolist()
            },
            "distribution": {
                "pe": pe_values
            }
        })

    except FileNotFoundError:
        return jsonify({
            "status": "error",
            "message": "File dataset tidak ditemukan."
        }), 404

    except ValueError as exc:
        return jsonify({
            "status": "error",
            "message": str(exc)
        }), 400

    except Exception:
        app.logger.exception(
            "Gagal memproses data visualisasi"
        )
        return jsonify({
            "status": "error",
            "message": "Gagal memproses data visualisasi."
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
