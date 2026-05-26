# Databricks notebook source
# MAGIC %md
# MAGIC # ML Model: Attendance Prediction
# MAGIC Predicts matchday attendance using fixture, weather, and historical features

# COMMAND ----------

# MAGIC %pip install scikit-learn mlflow --quiet

# COMMAND ----------

import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# COMMAND ----------

# Generate synthetic training data (replace with real Delta data when available)
np.random.seed(42)
n = 500
base_date = datetime.now() - timedelta(days=180)

data = {
    "fixture_date": [base_date + timedelta(days=i % 90) for i in range(n)],
    "is_weekend": [1 if (base_date + timedelta(days=i % 90)).weekday() >= 5 else 0 for i in range(n)],
    "opponent_tier": np.random.choice([1, 2, 3], n, p=[0.3, 0.5, 0.2]),  # 1=big, 3=small
    "temp_c": np.random.normal(12, 6, n).clip(-5, 30),
    "is_rain": np.random.binomial(1, 0.2, n),
    "competition": np.random.choice([1, 2], n, p=[0.7, 0.3]),  # 1=PL, 2=UCL
}
# Base attendance 45000-55000, modified by features
base_att = 50000 + np.random.normal(0, 2000, n)
# Use np.asarray: Python list * int repeats the list (breaks broadcast), not element-wise scale.
data["attendance"] = (
    base_att
    + data["opponent_tier"] * -3000
    + np.asarray(data["is_weekend"], dtype=np.float64) * 2000
    + data["temp_c"] * 100
    + data["is_rain"] * -4000
    + data["competition"] * 3000
).clip(35000, 76000)

df = pd.DataFrame(data)
df["fixture_date"] = pd.to_datetime(df["fixture_date"])
df["month"] = df["fixture_date"].dt.month
df["day_of_week"] = df["fixture_date"].dt.dayofweek

# COMMAND ----------

X = df[["is_weekend", "opponent_tier", "temp_c", "is_rain", "competition", "month", "day_of_week"]]
y = df["attendance"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# COMMAND ----------

mlflow.set_experiment("/Shared/manutd_attendance_ml")
with mlflow.start_run(run_name="attendance_rf_v1"):
    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    mlflow.log_metric("mae", mae)
    mlflow.sklearn.log_model(model, "model")
    mlflow.set_tag("model_type", "attendance_prediction")
    print(f"MAE: {mae:.0f}")

# COMMAND ----------

# MAGIC %md
# MAGIC Model registered. Use `mlflow.pyfunc.load_model('runs:/<run_id>/model')` to load for inference.
