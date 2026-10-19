const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const modelPath = path.join(__dirname, 'ml', 'rain_model.json');
const fallbackModel = {
  feature_order: [
    'temperature',
    'humidity',
    'pressure',
    'windSpeed',
    'cloudCover',
    'previousRainfall',
    'month',
    'cityFactor'
  ],
  scaler_mean: [0, 0, 0, 0, 0, 0, 0, 0],
  scaler_scale: [1, 1, 1, 1, 1, 1, 1, 1],
  coefficients: [0, 0, 0, 0, 0, 0, 0, 0],
  intercept: -1.5,
  city_factor: { Mumbai: 1.4 },
  month_factor: { 1: 0.45 }
};

let model = fallbackModel;
try {
  const raw = fs.readFileSync(modelPath, 'utf8');
  model = JSON.parse(raw);
} catch (error) {
  console.warn('ML model not found. Using fallback rule-based prediction.');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function getCityFactor(location) {
  const cityName = location || 'Mumbai';
  return model.city_factor?.[cityName] ?? model.city_factor?.Mumbai ?? 1.0;
}

function predictRainfall(payload) {
  const temperature = Number(payload.temperature) || 0;
  const humidity = clamp(Number(payload.humidity) || 0, 0, 100);
  const pressure = Number(payload.pressure) || 1010;
  const windSpeed = Number(payload.windSpeed) || 0;
  const cloudCover = clamp(Number(payload.cloudCover) || 0, 0, 100);
  const previousRainfall = Number(payload.previousRainfall) || 0;
  const month = clamp(Number(payload.month) || 1, 1, 12);
  const location = payload.location || 'Mumbai';
  const cityFactor = getCityFactor(location);

  const featureValues = {
    temperature,
    humidity,
    pressure,
    windSpeed,
    cloudCover,
    previousRainfall,
    month,
    cityFactor
  };

  let logit = Number(model.intercept || 0);
  const coefficientList = model.coefficients || [];
  const scalerMean = model.scaler_mean || [];
  const scalerScale = model.scaler_scale || [];

  for (let i = 0; i < (model.feature_order || []).length; i += 1) {
    const key = model.feature_order[i];
    const rawValue = Number(featureValues[key] ?? 0);
    const mean = Number(scalerMean[i] ?? 0);
    const scale = Number(scalerScale[i] ?? 1);
    const normalized = scale === 0 ? 0 : (rawValue - mean) / scale;
    logit += normalized * Number(coefficientList[i] ?? 0);
  }

  const probability = sigmoid(logit);
  const prediction = probability >= 0.5 ? 'Rain' : 'No Rain';

  const rainfallBoost = model.month_factor?.[month] || 1;
  const expectedRainfall = prediction === 'Rain'
    ? clamp(
        probability * (18 + humidity * 0.32 + cloudCover * 0.18 + previousRainfall * 0.9 + rainfallBoost * 18),
        3,
        95
      )
    : clamp((1 - probability) * (4 + previousRainfall * 0.4), 0, 12);

  return {
    prediction,
    probability: Number(probability.toFixed(6)),
    expectedRainfall: Number(expectedRainfall.toFixed(1)),
    confidence: Number((Math.abs(probability - 0.5) * 2).toFixed(2)),
    month,
    location,
    status: probability >= 0.5 ? 'Rain likely' : 'Dry spell likely'
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Rainfall Prediction API is running.' });
});

app.post('/api/predict', (req, res) => {
  try {
    const validationErrors = [];

    const requiredFields = ['temperature', 'humidity', 'pressure', 'windSpeed', 'cloudCover', 'previousRainfall', 'month'];
    requiredFields.forEach((field) => {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        validationErrors.push(`${field} is required.`);
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }

    const result = predictRainfall(req.body);
    return res.json(result);
  } catch (error) {
    console.error('Prediction error:', error);
    return res.status(500).json({ error: 'Unable to generate prediction', message: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Rainfall Prediction app is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
