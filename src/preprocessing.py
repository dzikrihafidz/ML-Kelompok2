from pathlib import Path

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "data" / "processed" / "CCPP_clean.csv"
MODEL_DIR = BASE_DIR / "models"

FEATURES = ["AT", "V", "AP", "RH"]
TARGET = "PE"


def load_data():
    """Load cleaned CCPP dataset."""
    return pd.read_csv(DATA_PATH)


def split_data(df, test_size=0.2, random_state=42):
    """Split dataset into features and target."""
    X = df[FEATURES]
    y = df[TARGET]

    return train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state
    )


def fit_regression_scaler(X_train):
    """Fit scaler using training data only."""
    scaler = StandardScaler()
    scaler.fit(X_train)

    return scaler


def fit_cluster_scaler(df):
    """Fit scaler for clustering features."""
    scaler = StandardScaler()
    scaler.fit(df[FEATURES])

    return scaler


def save_scalers(regression_scaler, cluster_scaler):
    """Save preprocessing objects."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(
        regression_scaler,
        MODEL_DIR / "regression_scaler.pkl"
    )

    joblib.dump(
        cluster_scaler,
        MODEL_DIR / "cluster_scaler.pkl"
    )


if __name__ == "__main__":
    df = load_data()

    X_train, X_test, y_train, y_test = split_data(df)

    regression_scaler = fit_regression_scaler(X_train)
    cluster_scaler = fit_cluster_scaler(df)

    save_scalers(
        regression_scaler,
        cluster_scaler
    )

    print("Preprocessing completed successfully.")
    print(f"Dataset shape : {df.shape}")
    print(f"Train shape   : {X_train.shape}")
    print(f"Test shape    : {X_test.shape}")