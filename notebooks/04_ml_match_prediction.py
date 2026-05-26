# Databricks notebook source
# MAGIC %md
# MAGIC # ML Model: Match Outcome Prediction
# MAGIC Uses API-Football data (standings, form, H2H) for match result prediction

# COMMAND ----------

# MAGIC %pip install scikit-learn mlflow --quiet

# COMMAND ----------

import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import pandas as pd
import numpy as np

# COMMAND ----------

# Generate training data from API-Football-like features
# In production: join standings, fixtures, team stats from Delta
np.random.seed(42)
n = 800

# Features: home_rank, away_rank, home_points, away_points, home_form_last5, is_derby
data = {
    "home_rank": np.random.randint(1, 21, n),
    "away_rank": np.random.randint(1, 21, n),
    "home_points": np.random.randint(20, 80, n),
    "away_points": np.random.randint(20, 80, n),
    "home_form_last5": np.random.randint(0, 16, n),  # 0-15 points from 5 games
    "away_form_last5": np.random.randint(0, 16, n),
    "is_derby": np.random.binomial(1, 0.1, n),
}
# Outcome: home win=2, draw=1, away win=0 (simplified from form + rank diff)
rank_diff = data["away_rank"] - data["home_rank"]
form_diff = data["home_form_last5"] - data["away_form_last5"]
prob_home = 0.4 + rank_diff * 0.01 + form_diff * 0.02 + data["is_derby"] * 0.05
prob_home = np.clip(prob_home, 0.2, 0.7)
data["result"] = np.where(np.random.random(n) < prob_home, 2, np.where(np.random.random(n) < 0.3, 1, 0))

df = pd.DataFrame(data)

# COMMAND ----------

X = df[["home_rank", "away_rank", "home_points", "away_points", "home_form_last5", "away_form_last5", "is_derby"]]
y = df["result"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# COMMAND ----------

mlflow.set_experiment("/Shared/manutd_match_prediction_ml")
with mlflow.start_run(run_name="match_outcome_rf_v1"):
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    mlflow.log_metric("accuracy", acc)
    mlflow.sklearn.log_model(model, "model")
    mlflow.set_tag("model_type", "match_prediction")
    print(classification_report(y_test, preds, target_names=["Away Win", "Draw", "Home Win"]))
    print(f"Accuracy: {acc:.3f}")
