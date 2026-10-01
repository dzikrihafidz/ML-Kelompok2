"use strict";

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();

    const refreshButton = document.getElementById("refresh-button");

    if (refreshButton) {
        refreshButton.addEventListener("click", loadDashboard);
    }
});

const chartColors = {
    green: "#55e6b0",
    blue: "#7c8cff",
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
        top: 55,
        right: 30,
        bottom: 65,
        left: 65
    },
    autosize: true
};

function setMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);

    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);
}

function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return "—";

    return number.toLocaleString("id-ID", {
        maximumFractionDigits: 2
    });
}

async function fetchJSON(url) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`Permintaan ${url} gagal (HTTP ${response.status}).`);
    }

    const result = await response.json();

    if (result.status !== "ok") {
        throw new Error(result.message || `Data dari ${url} tidak valid.`);
    }

    return result;
}

async function loadDashboard() {
    const refreshButton = document.getElementById("refresh-button");

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Memuat...";
    }

    try {
        if (typeof Plotly === "undefined") {
            throw new Error(
                "Library Plotly tidak berhasil dimuat. Periksa koneksi internet."
            );
        }

        await Promise.all([
            loadHealth(),
            loadSummary(),
            loadVisualizations()
        ]);
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "↻ Refresh Data";
        }
    }
}

async function loadHealth() {
    const statusElement = document.getElementById("backend-status");
    const dot = document.getElementById("backend-dot");

    try {
        const result = await fetchJSON("/api/health");

        if (statusElement) {
            statusElement.textContent =
                result.message || "Backend Flask berjalan";
        }

        if (dot) dot.classList.remove("offline");
    } catch (error) {
        if (statusElement) {
            statusElement.textContent = "Backend tidak terhubung";
        }

        if (dot) dot.classList.add("offline");

        console.error("Health check gagal:", error);
    }
}

async function loadSummary() {
    setMessage("summary-status", "Memuat ringkasan dataset...");

    try {
        const result = await fetchJSON("/api/summary");

        setText("total-rows", formatNumber(result.rows));
        setText("total-columns", formatNumber(result.columns));
        setText("missing-values", formatNumber(result.missing_values));

        const peStats = result.statistics?.PE;
        if (peStats) {
            setText("average-pe", formatNumber(peStats.mean));
        }

        renderStatistics(result.statistics || {});

        setMessage(
            "summary-status",
            `Ringkasan berhasil dimuat dari dataset aktual (${formatNumber(result.rows)} baris).`
        );
    } catch (error) {
        console.error("Gagal memuat ringkasan:", error);
        setMessage("summary-status", error.message, true);

        const tbody = document.getElementById("statistics-body");
        if (tbody) {
            tbody.innerHTML =
                '<tr><td colspan="5">Statistik tidak dapat dimuat.</td></tr>';
        }
    }
}

function setText(elementId, value) {
    const element = document.getElementById(elementId);

    if (element) element.textContent = value;
}

function renderStatistics(statistics) {
    const tbody = document.getElementById("statistics-body");
    if (!tbody) return;

    const variables = ["AT", "V", "AP", "RH", "PE"];

    tbody.replaceChildren();

    for (const variable of variables) {
        const stats = statistics[variable];

        if (!stats) continue;

        const row = document.createElement("tr");

        const values = [
            variable,
            formatNumber(stats.min),
            formatNumber(stats.mean),
            formatNumber(stats.max),
            formatNumber(stats.std)
        ];

        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }

    if (!tbody.children.length) {
        tbody.innerHTML =
            '<tr><td colspan="5">Statistik tidak tersedia.</td></tr>';
    }
}

async function loadVisualizations() {
    setMessage(
        "visualization-status",
        "Memuat data visualisasi dari CSV..."
    );

    try {
        const result = await fetchJSON("/api/visualizations");

        const scatter = result.scatter;
        const correlation = result.correlation;
        const distribution = result.distribution;

        const atValues = scatter?.x ?? scatter?.at;
        const peScatterValues = scatter?.y ?? scatter?.pe;
        const peDistributionValues = distribution?.pe;

        if (
            !Array.isArray(atValues) ||
            !Array.isArray(peScatterValues) ||
            atValues.length === 0 ||
            atValues.length !== peScatterValues.length
        ) {
            throw new Error(
                "Data AT dan PE untuk scatter plot tidak sesuai. Periksa respons /api/visualizations."
            );
        }

        if (
            !Array.isArray(correlation?.labels) ||
            !Array.isArray(correlation?.matrix) ||
            correlation.matrix.length !== correlation.labels.length ||
            correlation.matrix.some(
                row =>
                    !Array.isArray(row) ||
                    row.length !== correlation.labels.length
            )
        ) {
            throw new Error(
                "Data matriks korelasi tidak sesuai. Periksa respons API."
            );
        }

        if (
            !Array.isArray(peDistributionValues) ||
            peDistributionValues.length === 0
        ) {
            throw new Error(
                "Data distribusi PE kosong. Periksa respons API."
            );
        }

        renderScatterPlot(atValues, peScatterValues);
        renderCorrelationHeatmap(correlation);
        renderPEDistribution(peDistributionValues);

        setMessage(
            "visualization-status",
            `Visualisasi berhasil dimuat dari dataset aktual (${formatNumber(result.rows)} baris).`
        );
    } catch (error) {
        console.error("Gagal memuat visualisasi:", error);

        setMessage(
            "visualization-status",
            `Visualisasi gagal dimuat: ${error.message}`,
            true
        );
    }
}

function renderScatterPlot(atValues, peValues) {
    const element = document.getElementById("scatter-chart");

    if (!element) {
        throw new Error('Elemen grafik "scatter-chart" tidak ditemukan di HTML.');
    }

    const x = [];
    const y = [];

    for (let i = 0; i < atValues.length; i++) {
        const at = Number(atValues[i]);
        const pe = Number(peValues[i]);

        if (Number.isFinite(at) && Number.isFinite(pe)) {
            x.push(at);
            y.push(pe);
        }
    }

    if (x.length === 0) {
        throw new Error("Tidak ada pasangan data AT dan PE yang valid.");
    }

    Plotly.newPlot(
        element,
        [{
            x,
            y,
            type: "scattergl",
            mode: "markers",
            name: "Data aktual",
            marker: {
                color: chartColors.green,
                size: 5,
                opacity: 0.55
            },
            hovertemplate:
                "AT: %{x:.2f}<br>PE: %{y:.2f}<extra></extra>"
        }],
        {
            ...chartLayout,
            title: {
                text: "Ambient Temperature vs Electrical Power",
                font: { size: 16 }
            },
            xaxis: {
                title: "AT — Ambient Temperature",
                gridcolor: chartColors.grid,
                zerolinecolor: chartColors.grid
            },
            yaxis: {
                title: "PE — Electrical Power Output",
                gridcolor: chartColors.grid,
                zerolinecolor: chartColors.grid
            }
        },
        chartConfig
    );
}

function renderCorrelationHeatmap(data) {
    const element = document.getElementById("heatmap-chart");

    if (!element) {
        throw new Error('Elemen grafik "heatmap-chart" tidak ditemukan di HTML.');
    }

    const labels = data.labels;
    const matrix = data.matrix.map(row =>
        row.map(value => {
            const number = Number(value);
            return Number.isFinite(number) ? number : null;
        })
    );

    Plotly.newPlot(
        element,
        [{
            x: labels,
            y: labels,
            z: matrix,
            type: "heatmap",
            zmin: -1,
            zmax: 1,
            colorscale: [
                [0, "#4679d8"],
                [0.5, "#f1f5f9"],
                [1, "#20c997"]
            ],
            colorbar: {
                title: { text: "Korelasi" },
                tickfont: { color: chartColors.text }
            },
            hovertemplate:
                "%{y} vs %{x}<br>Korelasi: %{z:.3f}<extra></extra>"
        }],
        {
            ...chartLayout,
            title: {
                text: "Correlation Heatmap",
                font: { size: 16 }
            },
            margin: {
                top: 55,
                right: 35,
                bottom: 65,
                left: 75
            },
            xaxis: {
                side: "bottom",
                automargin: true
            },
            yaxis: {
                autorange: "reversed",
                automargin: true
            }
        },
        chartConfig
    );
}

function renderPEDistribution(peValues) {
    const element = document.getElementById("distribution-chart");

    if (!element) {
        throw new Error('Elemen grafik "distribution-chart" tidak ditemukan di HTML.');
    }

    const pe = peValues
        .map(Number)
        .filter(Number.isFinite);

    if (pe.length === 0) {
        throw new Error("Tidak ada nilai PE yang valid untuk histogram.");
    }

    Plotly.newPlot(
        element,
        [{
            x: pe,
            type: "histogram",
            name: "PE aktual",
            marker: {
                color: chartColors.blue,
                line: {
                    color: "#aab5ff",
                    width: 1
                }
            },
            hovertemplate:
                "Rentang PE: %{x}<br>Jumlah data: %{y}<extra></extra>"
        }],
        {
            ...chartLayout,
            title: {
                text: "Distribusi Electrical Power Output (PE)",
                font: { size: 16 }
            },
            xaxis: {
                title: "PE — Electrical Power Output",
                gridcolor: chartColors.grid
            },
            yaxis: {
                title: "Jumlah Data",
                gridcolor: chartColors.grid
            },
            bargap: 0.06
        },
        chartConfig
    );
}