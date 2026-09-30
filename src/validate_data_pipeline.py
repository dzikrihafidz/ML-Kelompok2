from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent

PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODEL_DIR = BASE_DIR / "models"

REQUIRED_DATASETS = [
    "CCPP_clean.csv",
    "CCPP_train.csv",
    "CCPP_test.csv",
]

REQUIRED_MODELS = [
    "regression_scaler.pkl",
    "cluster_scaler.pkl",
]


def validate_files():
    print("=== DATA FILES ===")

    for filename in REQUIRED_DATASETS:
        path = PROCESSED_DIR / filename
        exists = path.exists()

        print(f"{filename}: {exists}")

        if not exists:
            raise FileNotFoundError(path)


def validate_models():
    print("\n=== PREPROCESSING MODELS ===")

    for filename in REQUIRED_MODELS:
        path = MODEL_DIR / filename
        exists = path.exists()

        print(f"{filename}: {exists}")

        if not exists:
            raise FileNotFoundError(path)

        joblib.load(path)


def validate_dataset():
    print("\n=== DATASET VALIDATION ===")

    clean = pd.read_csv(
        PROCESSED_DIR / "CCPP_clean.csv"
    )

    train = pd.read_csv(
        PROCESSED_DIR / "CCPP_train.csv"
    )

    test = pd.read_csv(
        PROCESSED_DIR / "CCPP_test.csv"
    )

    print("Clean :", clean.shape)
    print("Train :", train.shape)
    print("Test  :", test.shape)

    assert clean.shape == (9527, 5)
    assert train.shape == (7621, 5)
    assert test.shape == (1906, 5)

    assert clean.isnull().sum().sum() == 0
    assert clean.duplicated().sum() == 0

    print("\nValidation passed.")


if __name__ == "__main__":
    validate_files()
    validate_models()
    validate_dataset()

    print("\nData Engineering handover is ready.")