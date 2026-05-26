# Databricks notebook source
# MAGIC %md
# MAGIC # ML Model: Injury Risk Prediction
# MAGIC Predicts player injury risk from workload and fatigue features

# COMMAND ----------

# MAGIC %pip install scikit-learn mlflow --quiet

# COMMAND ----------

import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import pandas as pd
import numpy as np

# COMMAND ----------

np.random.seed(42)
n = 400
# Features: training_load, fatigue, matches_played_7d, minutes_7d
data = {
    "training_load": np.random.uniform(50, 100, n),
    "fatigue": np.random.uniform(20, 80, n),
    "matches_7d": np.random.randint(0, 4, n),
    "minutes_7d": np.random.randint(0, 360, n),
}
# Injury risk: higher when fatigue high + load high + many minutes
risk_score = (
    data["fatigue"] * 0.3
    + data["training_load"] * 0.2
    + data["matches_7d"] * 15
    + data["minutes_7d"] * 0.05
)
data["injury_risk"] = (risk_score > 60).astype(int)

df = pd.DataFrame(data)

# COMMAND ----------

X = df[["training_load", "fatigue", "matches_7d", "minutes_7d"]]
y = df["injury_risk"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# COMMAND ----------

mlflow.set_experiment("/Shared/manutd_injury_risk_ml")
with mlflow.start_run(run_name="injury_risk_rf_v1"):
    model = RandomForestClassifier(n_estimators=80, max_depth=8, random_state=42)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, proba)
    mlflow.log_metric("roc_auc", auc)
    mlflow.sklearn.log_model(model, "model")
    mlflow.set_tag("model_type", "injury_risk")
    print(classification_report(y_test, preds))
    print(f"ROC-AUC: {auc:.3f}")
