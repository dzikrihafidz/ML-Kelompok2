
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "processed" / "CCPP_clean.csv"
MODEL_DIR = BASE_DIR / "models"

REGRESSION_MODEL_PATH = MODEL_DIR / "final_regression_model.pkl"
CLUSTER_MODEL_PATH = MODEL_DIR / "kmeans_clustering.pkl"
CLUSTER_SCALER_PATH = MODEL_DIR / "cluster_scaler.pkl"

FEATURES = ["AT", "V", "AP", "RH"]
REQUIRED_COLUMNS = FEATURES + ["PE"]

# Deskripsi karakteristik setiap cluster berdasarkan interpretasi tim.
CLUSTER_DESCRIPTIONS = {
    0: {
        "label": "Cluster 0",
        "description": (
            "AT lebih rendah, V lebih rendah, RH lebih tinggi, "
            "dan PE lebih tinggi."
        ),
        "characteristics": [
            "AT (Ambient Temperature): relatif lebih rendah",
            "V (Exhaust Vacuum): relatif lebih rendah",
            "RH (Relative Humidity): relatif lebih tinggi",
            "PE (Electrical Power Output): relatif lebih tinggi",
        ],
    },
    1: {
        "label": "Cluster 1",
        "description": (
            "AT lebih tinggi, V lebih tinggi, RH lebih rendah, "
            "dan PE lebih rendah."
        ),
        "characteristics": [
            "AT (Ambient Temperature): relatif lebih tinggi",
            "V (Exhaust Vacuum): relatif lebih tinggi",
            "RH (Relative Humidity): relatif lebih rendah",
            "PE (Electrical Power Output): relatif lebih rendah",
        ],
    },
}

# Model dimuat saat pertama kali endpoint prediksi digunakan.
# Model yang sudah dimuat digunakan kembali untuk request berikutnya.
_model_cache = None


def load_dataset():
    """Membaca dataset aktual dan memvalidasi kolomnya."""
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


def load_models():
    """Memuat model regresi, model clustering, dan scaler."""
    global _model_cache

    if _model_cache is not None:
        return _model_cache

    required_files = [
        REGRESSION_MODEL_PATH,
        CLUSTER_MODEL_PATH,
        CLUSTER_SCALER_PATH,
    ]

    missing_files = [
        str(path)
        for path in required_files
        if not path.is_file()
    ]

    if missing_files:
        raise FileNotFoundError(
            "File model tidak ditemukan: "
            + ", ".join(missing_files)
        )

    regression_model = joblib.load(REGRESSION_MODEL_PATH)
    cluster_model = joblib.load(CLUSTER_MODEL_PATH)
    cluster_scaler = joblib.load(CLUSTER_SCALER_PATH)

    _model_cache = (
        regression_model,
        cluster_model,
        cluster_scaler,
    )

    return _model_cache


@app.route("/")
def index():
    """Menampilkan halaman dashboard."""
    return render_template("index.html")


@app.route("/api/health")
def health():
    """Memeriksa status backend Flask."""
    return jsonify({
        "status": "ok",
        "message": "Backend Flask berjalan",
    })


@app.route("/api/predict", methods=["POST"])
def predict():
    """Memprediksi PE dan cluster dari empat input pengguna."""
    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        return jsonify({
            "status": "error",
            "message": (
                "Kirim input dalam format JSON "
                "dengan field AT, V, AP, dan RH."
            ),
        }), 400

    missing_features = [
        feature
        for feature in FEATURES
        if feature not in payload
    ]

    if missing_features:
        return jsonify({
            "status": "error",
            "message": (
                "Input belum lengkap: "
                + ", ".join(missing_features)
            ),
        }), 400

    try:
        values = {}

        for feature in FEATURES:
            value = payload[feature]

            # Boolean tidak diterima sebagai angka input.
            if isinstance(value, bool):
                raise ValueError(
                    f"Nilai {feature} harus berupa angka."
                )

            try:
                number = float(value)
            except (TypeError, ValueError):
                raise ValueError(
                    f"Nilai {feature} harus berupa angka."
                ) from None

            if not np.isfinite(number):
                raise ValueError(
                    f"Nilai {feature} harus berupa angka finite."
                )

            values[feature] = number

        # Mempertahankan nama dan urutan fitur saat training.
        input_df = pd.DataFrame(
            [[values[feature] for feature in FEATURES]],
            columns=FEATURES,
        )

        (
            regression_model,
            cluster_model,
            cluster_scaler,
        ) = load_models()

        # Model Random Forest menggunakan input tanpa scaling.
        prediction_pe = float(
            regression_model.predict(input_df)[0]
        )

        # Model K-Means menggunakan input yang sudah di-scaling.
        scaled_input = cluster_scaler.transform(input_df)

        cluster_id = int(
            cluster_model.predict(scaled_input)[0]
        )

        # Ambil deskripsi sesuai cluster yang diprediksi.
        cluster_info = CLUSTER_DESCRIPTIONS.get(
            cluster_id,
            {
                "label": f"Cluster {cluster_id}",
                "description": (
                    "Karakteristik cluster ini belum tersedia."
                ),
                "characteristics": [],
            },
        )

        clustering_result = {
            "cluster_id": cluster_id,
            "label": cluster_info["label"],
            "description": cluster_info["description"],
            "characteristics": cluster_info["characteristics"],
        }

        return jsonify({
            "status": "ok",
            "input": values,
            "prediction": {
                "pe": round(prediction_pe, 3),
                "unit": "MW",
            },
            "clustering": clustering_result,
        })

    except ValueError as exc:
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400

    except FileNotFoundError as exc:
        app.logger.error("File model tidak tersedia: %s", exc)

        return jsonify({
            "status": "error",
            "message": (
                "File model atau scaler tidak ditemukan. "
                "Periksa isi folder models."
            ),
        }), 503

    except Exception:
        app.logger.exception("Gagal menjalankan prediksi")

        return jsonify({
            "status": "error",
            "message": (
                "Prediksi gagal dijalankan. "
                "Periksa log backend."
            ),
        }), 500


@app.route("/api/summary")
def dataset_summary():
    """Menyediakan ringkasan statistik dataset."""
    try:
        df = load_dataset()

        selected_df = df[REQUIRED_COLUMNS].apply(
            pd.to_numeric,
            errors="coerce",
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
            "statistics": stats.to_dict(),
        })

    except FileNotFoundError:
        return jsonify({
            "status": "error",
            "message": "File dataset tidak ditemukan.",
        }), 404

    except ValueError as exc:
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400

    except Exception:
        app.logger.exception("Gagal membaca dataset")

        return jsonify({
            "status": "error",
            "message": "Gagal memproses dataset.",
        }), 500


@app.route("/api/visualizations")
def api_visualizations():
    """Menyediakan data aktual untuk grafik dashboard."""
    try:
        df = load_dataset()

        numeric_df = df[REQUIRED_COLUMNS].apply(
            pd.to_numeric,
            errors="coerce",
        )

        scatter_df = numeric_df[["AT", "PE"]].dropna()

        if scatter_df.empty:
            return jsonify({
                "status": "error",
                "message": "Tidak ada data AT dan PE yang valid.",
            }), 400

        correlation_df = numeric_df.dropna(
            subset=REQUIRED_COLUMNS
        )

        if correlation_df.empty:
            return jsonify({
                "status": "error",
                "message": (
                    "Tidak ada baris lengkap untuk "
                    "menghitung korelasi."
                ),
            }), 400

        correlation = correlation_df.corr()
        pe_values = numeric_df["PE"].dropna().tolist()

        if not pe_values:
            return jsonify({
                "status": "error",
                "message": "Tidak ada nilai PE yang valid.",
            }), 400

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
                "y": scatter_pe,
            },
            "correlation": {
                "labels": REQUIRED_COLUMNS,
                "matrix": correlation.values.tolist(),
            },
            "distribution": {
                "pe": pe_values,
            },
        })

    except FileNotFoundError:
        return jsonify({
            "status": "error",
            "message": "File dataset tidak ditemukan.",
        }), 404

    except ValueError as exc:
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400

    except Exception:
        app.logger.exception(
            "Gagal memproses data visualisasi"
        )

        return jsonify({
            "status": "error",
            "message": "Gagal memproses data visualisasi.",
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
