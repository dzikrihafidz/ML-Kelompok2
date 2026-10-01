# ML1 Model Handover

## Informasi Model

Model yang diserahkan ke tim Backend adalah model supervised learning untuk memprediksi `Electrical Power Output (PE)` pada dataset Combined Cycle Power Plant (CCPP).

### Model

- Algoritma: Random Forest Regression
- Target: `PE`
- Feature set: `AT`, `V`, `AP`, `RH`

## Hyperparameter Model Final

Hyperparameter diperoleh melalui `GridSearchCV` dengan 5-Fold Cross-Validation.

```text
n_estimators      = 300
max_depth         = None
min_samples_split = 2
min_samples_leaf  = 1