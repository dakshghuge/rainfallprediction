import json
import math
import random
from pathlib import Path

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "weather_dataset.csv"
MODEL_PATH = BASE_DIR / "rain_model.json"

CITY_FACTORS = {
    "Mumbai": 1.40,
    "Pune": 0.90,
    "Nashik": 0.85,
    "Jalgaon": 1.05,
    "Delhi": 0.40,
    "Bengaluru": 1.10,
    "Ahmedabad": 0.50,
    "Kolkata": 1.55,
    "Hyderabad": 0.95,
    "Chennai": 1.20,
    "Jaipur": 0.35,
    "Lucknow": 0.60,
    "Kochi": 1.75,
    "Goa": 1.45,
}

MONTH_FACTOR = {
    1: 0.45, 2: 0.42, 3: 0.52, 4: 0.68, 5: 0.81,
    6: 1.15, 7: 1.60, 8: 1.50, 9: 1.25, 10: 0.92, 11: 0.66, 12: 0.50,
}

CITY_BASE = {
    "Mumbai": {"temperature": 29, "humidity": 76, "pressure": 1008, "wind": 12},
    "Pune": {"temperature": 26, "humidity": 68, "pressure": 1012, "wind": 10},
    "Nashik": {"temperature": 27, "humidity": 66, "pressure": 1011, "wind": 11},
    "Jalgaon": {"temperature": 30, "humidity": 70, "pressure": 1009, "wind": 13},
    "Delhi": {"temperature": 32, "humidity": 48, "pressure": 1015, "wind": 16},
    "Bengaluru": {"temperature": 27, "humidity": 72, "pressure": 1010, "wind": 11},
    "Ahmedabad": {"temperature": 33, "humidity": 52, "pressure": 1014, "wind": 15},
    "Kolkata": {"temperature": 31, "humidity": 79, "pressure": 1007, "wind": 14},
    "Hyderabad": {"temperature": 30, "humidity": 62, "pressure": 1011, "wind": 13},
    "Chennai": {"temperature": 31, "humidity": 74, "pressure": 1009, "wind": 12},
    "Jaipur": {"temperature": 34, "humidity": 43, "pressure": 1016, "wind": 17},
    "Lucknow": {"temperature": 31, "humidity": 58, "pressure": 1013, "wind": 14},
    "Kochi": {"temperature": 29, "humidity": 82, "pressure": 1006, "wind": 10},
    "Goa": {"temperature": 29, "humidity": 78, "pressure": 1008, "wind": 12},
}


def sigmoid(value):
    return 1 / (1 + math.exp(-value))


def generate_dataset(rows=5000):
    records = []

    for _ in range(rows):
        city = random.choice(list(CITY_FACTORS.keys()))
        month = random.randint(1, 12)
        city_profile = CITY_BASE[city]

        seasonal_temp_shift = (month - 6) * 1.5
        seasonal_humidity_shift = (month >= 6 and month <= 9) * 12

        temperature = city_profile["temperature"] + seasonal_temp_shift + random.uniform(-6, 6)
        humidity = city_profile["humidity"] + seasonal_humidity_shift + random.uniform(-18, 18)
        humidity = max(15, min(98, humidity))

        pressure = city_profile["pressure"] + random.uniform(-10, 10)
        wind_speed = city_profile["wind"] + random.uniform(-8, 12)
        cloud_cover = min(100, max(5, humidity * 0.75 + random.uniform(-15, 18)))
        previous_rainfall = max(0, random.gauss(8, 10))

        city_factor = CITY_FACTORS[city]
        month_factor = MONTH_FACTOR[month]

        score = -5.2
        score += humidity * 0.06
        score += cloud_cover * 0.04
        score += previous_rainfall * 0.09
        score += city_factor * 1.8
        score += month_factor * 1.6
        score += (temperature >= 22 and temperature <= 32) * 1.1
        score += (pressure >= 1000 and pressure <= 1015) * 1.4
        score += (wind_speed > 25) * -1.2
        score += (humidity > 70 and cloud_cover > 55) * 2.0
        score += (humidity < 35 and cloud_cover < 25) * -1.6

        probability = sigmoid(score)
        rain_label = 1 if random.random() < probability else 0
        rainfall_mm = random.uniform(0.5, 20) if rain_label == 1 else random.uniform(0, 2.5)
        if rain_label == 1:
            rainfall_mm = max(4, rainfall_mm + humidity * 0.22 + cloud_cover * 0.15 + previous_rainfall * 0.7)

        records.append(
            {
                "temperature": round(temperature, 2),
                "humidity": round(humidity, 2),
                "pressure": round(pressure, 2),
                "windSpeed": round(wind_speed, 2),
                "cloudCover": round(cloud_cover, 2),
                "previousRainfall": round(previous_rainfall, 2),
                "month": month,
                "cityFactor": round(city_factor, 3),
                "rainLabel": rain_label,
                "rainfallMm": round(rainfall_mm, 2),
                "location": city,
            }
        )

    return pd.DataFrame(records)


def main():
    df = generate_dataset()
    df.to_csv(DATASET_PATH, index=False)

    feature_cols = [
        "temperature",
        "humidity",
        "pressure",
        "windSpeed",
        "cloudCover",
        "previousRainfall",
        "month",
        "cityFactor",
    ]

    X = df[feature_cols]
    y = df["rainLabel"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(max_iter=5000, class_weight="balanced", random_state=42)),
        ]
    )

    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"Model accuracy: {accuracy:.4f}")

    scaler = model.named_steps["scaler"]
    classifier = model.named_steps["classifier"]

    artifact = {
        "model_type": "logistic_regression",
        "feature_order": feature_cols,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "coefficients": classifier.coef_[0].tolist(),
        "intercept": float(classifier.intercept_[0]),
        "city_factor": CITY_FACTORS,
        "month_factor": MONTH_FACTOR,
        "classes": [0, 1],
        "accuracy": round(float(accuracy), 4),
    }

    MODEL_PATH.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
