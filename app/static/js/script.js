"use strict";

/* =========================================================
   INISIALISASI
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    checkBackend();

    const predictionForm = getElement("prediction-form");

    if (predictionForm) {
        predictionForm.addEventListener(
            "submit",
            handlePredictionSubmit
        );

        predictionForm.addEventListener("input", () => {
            clearPredictionResults();
        });
    }
});


/* =========================================================
   KONFIGURASI GRAFIK
   ========================================================= */

const chartColors = {
    green: "#55e6b0",
    blue: "#7c8cff",
    purple: "#c084fc",
    orange: "#f4b860",
    text: "#dbe7f5",
    muted: "#9db0d0",
    grid: "#263650",
    background: "#141f35"
};

const chartConfig = {
    responsive: true,
    displaylogo: false
};

const chartLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",

    font: {
        color: chartColors.text,
        family: "Inter, Segoe UI, Arial, sans-serif"
    },

    margin: {
        top: 35,
        right: 35,
        bottom: 65,
        left: 75
    },

    autosize: true
};


/* =========================================================
   HELPER
   ========================================================= */

function getElement(id) {
    return document.getElementById(id);
}

function setText(elementId, value) {
    const element = getElement(elementId);

    if (element) {
        element.textContent = value;
    }
}

function setMessage(elementId, message, isError = false) {
    const element = getElement(elementId);

    if (!element) {
        return;
    }

    element.textContent = message;
    element.classList.toggle("error", isError);
}

function formatNumber(value, digits = 3) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits
    });
}


/* =========================================================
   STATUS BACKEND FLASK
   ========================================================= */

async function checkBackend() {
    const statusElement = getElement("backend-status");
    const dot = getElement("backend-dot");

    try {
        const response = await fetch("/api/health", {
            headers: {
                Accept: "application/json"
            }
        });

        const result = await response.json();

        if (!response.ok || result.status !== "ok") {
            throw new Error("Backend Flask tidak merespons.");
        }

        if (statusElement) {
            statusElement.textContent =
                result.message || "Backend Flask berjalan";
        }

        if (dot) {
            dot.classList.remove("offline");
        }

    } catch (error) {
        if (statusElement) {
            statusElement.textContent = "Backend tidak terhubung";
        }

        if (dot) {
            dot.classList.add("offline");
        }

        console.error("Health check gagal:", error);
    }
}


/* =========================================================
   BERSIHKAN HASIL LAMA KETIKA INPUT BERUBAH
   ========================================================= */

function clearPredictionResults() {
    const resultPanel = getElement("prediction-result");
    const visualizationSection = getElement("visualizations");

    if (resultPanel) {
        resultPanel.hidden = true;
    }

    if (visualizationSection) {
        visualizationSection.hidden = true;
    }

    setMessage(
        "prediction-status",
        "Input berubah. Klik Hitung Prediksi untuk menjalankan model kembali."
    );
}


/* =========================================================
   SUBMIT INPUT KE MODEL FLASK
   ========================================================= */

async function handlePredictionSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = getElement("predict-button");
    const resultPanel = getElement("prediction-result");
    const visualizationSection = getElement("visualizations");

    const formData = new FormData(form);

    // Empat fitur yang dibutuhkan model.
    const values = {
        AT: Number(formData.get("AT")),
        V: Number(formData.get("V")),
        AP: Number(formData.get("AP")),
        RH: Number(formData.get("RH"))
    };

    // Pastikan semua nilai input valid.
    const allInputsValid = Object.values(values).every(
        value => Number.isFinite(value)
    );

    if (!allInputsValid) {
        setMessage(
            "prediction-status",
            "Pastikan semua input berisi angka yang valid.",
            true
        );

        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Menghitung...";
    }

    if (resultPanel) {
        resultPanel.hidden = true;
    }

    if (visualizationSection) {
        visualizationSection.hidden = true;
    }

    setMessage(
        "prediction-status",
        "Model sedang menghitung prediksi PE dan cluster..."
    );

    try {
        // Hanya mengirim input terbaru ke endpoint prediksi.
        const response = await fetch("/api/predict", {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },

            body: JSON.stringify(values)
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error(
                "Respons backend bukan JSON yang valid."
            );
        }

        if (!response.ok || result.status !== "ok") {
            throw new Error(
                result.message ||
                `Prediksi gagal (HTTP ${response.status}).`
            );
        }

        const prediction = result.prediction;
        const clustering = result.clustering;
        const returnedInput = result.input || values;

        const predictedPE = Number(prediction?.pe);
        const clusterId = Number(clustering?.cluster_id);
        const clusterLabel = clustering?.label;

        if (!Number.isFinite(predictedPE)) {
            throw new Error(
                "Nilai prediksi PE dari backend tidak valid."
            );
        }

        if (
            !Number.isInteger(clusterId) ||
            typeof clusterLabel !== "string" ||
            clusterLabel.trim() === ""
        ) {
            throw new Error(
                "Informasi clustering dari backend tidak lengkap."
            );
        }

        /* -----------------------------------------------
           1. HASIL REGRESI PE
           ----------------------------------------------- */

        setText(
            "prediction-pe",
            formatNumber(predictedPE, 3)
        );

        /*
         * Estimasi energi:
         * energi (MWh) = daya (MW) x waktu (jam).
         *
         * Perhitungan ini mengasumsikan daya konstan.
         */
        const energy1Hour = predictedPE * 1;
        const energy24Hours = predictedPE * 24;

        setText(
            "energy-1h",
            formatNumber(energy1Hour, 3)
        );

        setText(
            "energy-24h",
            formatNumber(energy24Hours, 3)
        );


        /* -----------------------------------------------
           2. HASIL CLUSTERING
           ----------------------------------------------- */

        setText("prediction-cluster", clusterLabel);

        const clusterDescription =
            clustering.description ||
            getClusterDescription(clusterId);

        setText(
            "prediction-cluster-description",
            clusterDescription
        );

        setText("visual-cluster-label", clusterLabel);

        setText(
            "visual-cluster-description",
            clusterDescription
        );

        // Isi karakteristik cluster dari respons Flask.
        const characteristicsList = getElement(
            "prediction-cluster-characteristics"
        );

        if (characteristicsList) {
            characteristicsList.replaceChildren();

            let characteristics = Array.isArray(
                clustering.characteristics
            )
                ? clustering.characteristics
                : [];

            // Jika backend tidak mengirim daftar karakteristik,
            // gunakan keterangan berdasarkan cluster ID.
            if (characteristics.length === 0) {
                characteristics =
                    getClusterCharacteristics(clusterId);
            }

            characteristics.forEach(characteristic => {
                const item = document.createElement("li");
                item.textContent = characteristic;
                characteristicsList.appendChild(item);
            });
        }


        /* -----------------------------------------------
           3. TAMPILKAN INPUT YANG DIPROSES
           ----------------------------------------------- */

        setText(
            "result-at",
            formatNumber(returnedInput.AT)
        );

        setText(
            "result-v",
            formatNumber(returnedInput.V)
        );

        setText(
            "result-ap",
            formatNumber(returnedInput.AP)
        );

        setText(
            "result-rh",
            formatNumber(returnedInput.RH)
        );


        /* -----------------------------------------------
           4. TAMPILKAN PANEL HASIL DAN VISUALISASI
           ----------------------------------------------- */

        if (resultPanel) {
            resultPanel.hidden = false;
        }

        if (visualizationSection) {
            visualizationSection.hidden = false;
        }


        /* -----------------------------------------------
           5. BUAT GRAFIK DARI INPUT DAN HASIL MODEL
           ----------------------------------------------- */

        renderInputChart(returnedInput);
        renderPredictionChart(predictedPE);


        /* -----------------------------------------------
           6. PESAN SUKSES
           ----------------------------------------------- */

        setMessage(
            "prediction-status",
            "Prediksi berhasil! Hasil regresi, estimasi energi, clustering, dan grafik telah diperbarui."
        );

        // Atur ulang ukuran grafik setelah panel ditampilkan.
        if (typeof Plotly !== "undefined") {
            window.requestAnimationFrame(() => {
                ["input-chart", "prediction-chart"].forEach(id => {
                    const chart = getElement(id);

                    if (chart && chart.data) {
                        Plotly.Plots.resize(chart);
                    }
                });
            });
        }

    } catch (error) {
        console.error("Prediksi gagal:", error);

        setMessage(
            "prediction-status",
            error.message ||
            "Terjadi kesalahan saat memproses prediksi.",
            true
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Hitung Prediksi";
        }
    }
}


/* =========================================================
   KETERANGAN CLUSTER
   ========================================================= */

function getClusterDescription(clusterId) {
    if (clusterId === 0) {
        return (
            "Cluster 0: karakteristik kelompok relatif memiliki " +
            "AT lebih rendah, V lebih rendah, RH lebih tinggi, " +
            "dan PE lebih tinggi."
        );
    }

    if (clusterId === 1) {
        return (
            "Cluster 1: karakteristik kelompok relatif memiliki " +
            "AT lebih tinggi, V lebih tinggi, RH lebih rendah, " +
            "dan PE lebih rendah."
        );
    }

    return "Karakteristik untuk cluster ini belum tersedia.";
}

function getClusterCharacteristics(clusterId) {
    if (clusterId === 0) {
        return [
            "AT (Ambient Temperature): relatif lebih rendah",
            "V (Exhaust Vacuum): relatif lebih rendah",
            "RH (Relative Humidity): relatif lebih tinggi",
            "PE (Electrical Power Output): relatif lebih tinggi"
        ];
    }

    if (clusterId === 1) {
        return [
            "AT (Ambient Temperature): relatif lebih tinggi",
            "V (Exhaust Vacuum): relatif lebih tinggi",
            "RH (Relative Humidity): relatif lebih rendah",
            "PE (Electrical Power Output): relatif lebih rendah"
        ];
    }

    return [
        "Karakteristik cluster belum tersedia."
    ];
}


/* =========================================================
   VISUALISASI INPUT PENGGUNA
   Data hanya berasal dari respons /api/predict.
   ========================================================= */

function renderInputChart(input) {
    const element = getElement("input-chart");

    if (!element) {
        return;
    }

    if (typeof Plotly === "undefined") {
        element.textContent =
            "Plotly tidak tersedia. Periksa koneksi internet.";
        return;
    }

    const labels = [
        "AT — Ambient Temperature",
        "V — Exhaust Vacuum",
        "AP — Ambient Pressure",
        "RH — Relative Humidity"
    ];

    const values = [
        Number(input.AT),
        Number(input.V),
        Number(input.AP),
        Number(input.RH)
    ];

    if (!values.every(Number.isFinite)) {
        element.textContent =
            "Nilai input tidak valid untuk divisualisasikan.";
        return;
    }

    const trace = {
        type: "bar",
        orientation: "h",

        y: labels,
        x: values,

        marker: {
            color: [
                chartColors.green,
                chartColors.blue,
                chartColors.purple,
                chartColors.orange
            ]
        },

        text: values.map(value => formatNumber(value)),
        textposition: "auto",

        hovertemplate:
            "%{y}<br>Nilai input: %{x}<extra></extra>"
    };

    const layout = {
        ...chartLayout,

        margin: {
            top: 25,
            right: 35,
            bottom: 50,
            left: 205
        },

        xaxis: {
            title: "Nilai input",
            gridcolor: chartColors.grid,
            zerolinecolor: chartColors.grid
        },

        yaxis: {
            automargin: true,
            autorange: "reversed"
        },

        showlegend: false
    };

    Plotly.react(
        element,
        [trace],
        layout,
        chartConfig
    );
}


/* =========================================================
   VISUALISASI OUTPUT REGRESI
   Grafik menampilkan satu prediksi PE saja.
   ========================================================= */

function renderPredictionChart(predictedPE) {
    const element = getElement("prediction-chart");

    if (!element) {
        return;
    }

    if (typeof Plotly === "undefined") {
        element.textContent =
            "Plotly tidak tersedia. Periksa koneksi internet.";
        return;
    }

    if (!Number.isFinite(predictedPE)) {
        element.textContent =
            "Hasil prediksi PE tidak valid.";
        return;
    }

    const trace = {
        type: "bar",

        x: ["Prediksi PE"],
        y: [predictedPE],

        marker: {
            color: chartColors.green
        },

        text: [
            `${formatNumber(predictedPE, 3)} MW`
        ],

        textposition: "outside",

        hovertemplate:
            "Output model: %{y:.3f} MW<extra></extra>"
    };

    const layout = {
        ...chartLayout,

        title: {
            text: "Output Regresi untuk Input Saat Ini",
            font: {
                size: 16,
                color: chartColors.text
            }
        },

        margin: {
            top: 65,
            right: 45,
            bottom: 60,
            left: 75
        },

        xaxis: {
            title: "Hasil model",
            gridcolor: chartColors.grid
        },

        yaxis: {
            title: "Electrical Power Output (MW)",
            gridcolor: chartColors.grid,
            rangemode: "tozero"
        },

        showlegend: false
    };

    Plotly.react(
        element,
        [trace],
        layout,
        chartConfig
    );
}