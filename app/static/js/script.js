
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    checkBackend();

    const predictionForm = document.getElementById("prediction-form");

    if (predictionForm) {
        predictionForm.addEventListener(
            "submit",
            handlePredictionSubmit
        );

        // Jika input diubah, hasil lama disembunyikan agar tidak
        // disangka sebagai hasil dari input yang baru.
        predictionForm.addEventListener("input", () => {
            clearPredictionResults();
        });
    }
});

// ============================================================
// KONFIGURASI VISUALISASI
// ============================================================

const chartColors = {
    green: "#55e6b0",
    blue: "#7c8cff",
    purple: "#c084fc",
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
        right: 25,
        bottom: 65,
        left: 70
    },

    autosize: true
};

// ============================================================
// HELPER
// ============================================================

function setText(elementId, value) {
    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = value;
    }
}

function setMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = message;
    element.classList.toggle("error", isError);
}

function formatNumber(value, digits = 2) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits
    });
}

function getElement(id) {
    return document.getElementById(id);
}

// ============================================================
// STATUS BACKEND
// ============================================================

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
            throw new Error("Backend Flask tidak merespons dengan benar.");
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

// ============================================================
// MEMBERSIHKAN HASIL LAMA
// ============================================================

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

// ============================================================
// SUBMIT PREDIKSI KE FLASK
// ============================================================

async function handlePredictionSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = getElement("predict-button");

    const resultPanel = getElement("prediction-result");
    const visualizationSection = getElement("visualizations");

    const formData = new FormData(form);

    // Nilai input yang dikirim ke endpoint POST /api/predict.
    const values = {
        AT: Number(formData.get("AT")),
        V: Number(formData.get("V")),
        AP: Number(formData.get("AP")),
        RH: Number(formData.get("RH"))
    };

    // Validasi input.
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
            throw new Error("Respons backend bukan JSON yang valid.");
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
        const clusterLabel = clustering?.label;

        if (
            !Number.isFinite(predictedPE) ||
            typeof clusterLabel !== "string" ||
            clusterLabel.trim() === ""
        ) {
            throw new Error(
                "Respons prediksi backend tidak lengkap."
            );
        }

        // Tampilkan hasil regresi.
        setText("prediction-pe", formatNumber(predictedPE, 3));

        // Tampilkan hasil clustering.
        setText("prediction-cluster", clusterLabel);

        setText(
            "prediction-cluster-description",
            clustering.description ||
            "Keterangan cluster belum tersedia."
        );

        // Tampilkan karakteristik cluster dengan aman.
        const characteristicsList = getElement(
            "prediction-cluster-characteristics"
        );

        if (characteristicsList) {
            characteristicsList.replaceChildren();

            const characteristics = Array.isArray(
                clustering.characteristics
            )
                ? clustering.characteristics
                : [];

            characteristics.forEach(characteristic => {
                const item = document.createElement("li");
                item.textContent = characteristic;
                characteristicsList.appendChild(item);
            });
        }

        // Tampilkan empat nilai yang benar-benar diproses.
        setText("result-at", formatNumber(returnedInput.AT));
        setText("result-v", formatNumber(returnedInput.V));
        setText("result-ap", formatNumber(returnedInput.AP));
        setText("result-rh", formatNumber(returnedInput.RH));

        // Tampilkan hasil prediksi terlebih dahulu.
        if (resultPanel) {
            resultPanel.hidden = false;
        }

        // Siapkan visualisasi setelah respons model berhasil diterima.
        if (visualizationSection) {
            visualizationSection.hidden = false;
        }

        // Render grafik menggunakan input dan output dari request ini.
        renderInputChart(returnedInput);
        renderPredictionChart(predictedPE);

        // Tampilkan hasil cluster pada bagian visualisasi.
        setText("visual-cluster-label", clusterLabel);

        setText(
            "visual-cluster-description",
            clustering.description ||
            "Keterangan cluster belum tersedia."
        );

        setMessage(
            "prediction-status",
            "Prediksi berhasil! Hasil regresi, clustering, dan visualisasi telah diperbarui."
        );

        // Grafik baru sekarang terlihat; sesuaikan ukurannya.
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

// ============================================================
// VISUALISASI INPUT PENGGUNA
// Data diambil dari respons /api/predict terbaru.
// Tidak membaca ulang CSV atau /api/visualizations.
// ============================================================

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
        "AT — Temperature",
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
                "#f4b860"
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
            bottom: 45,
            left: 190
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

// ============================================================
// VISUALISASI OUTPUT REGRESI
// Satu batang = satu hasil prediksi dari model.
// Bukan distribusi seluruh dataset.
// ============================================================

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

        text: [`${formatNumber(predictedPE, 3)} MW`],
        textposition: "outside",

        hovertemplate:
            "Output model: %{y:.3f} MW<extra></extra>"
    };

    const layout = {
        ...chartLayout,

        margin: {
            top: 45,
            right: 30,
            bottom: 55,
            left: 75
        },

        xaxis: {
            title: "",
            gridcolor: chartColors.grid
        },

        yaxis: {
            title: "Prediksi PE (MW)",
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
