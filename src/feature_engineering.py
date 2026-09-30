import pandas as pd


BASE_FEATURES = ["AT", "V", "AP", "RH"]


def create_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create engineered features from CCPP input variables."""
    result = df[BASE_FEATURES].copy()

    result["AT_squared"] = result["AT"] ** 2
    result["AT_V_interaction"] = result["AT"] * result["V"]
    result["AP_RH_ratio"] = result["AP"] / result["RH"]

    return result