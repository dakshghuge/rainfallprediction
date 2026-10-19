const form = document.getElementById('predictionForm');
const resultBadge = document.getElementById('resultBadge');
const predictionIcon = document.getElementById('predictionIcon');
const predictionTitle = document.getElementById('predictionTitle');
const predictionSubtitle = document.getElementById('predictionSubtitle');
const probabilityValue = document.getElementById('probabilityValue');
const rainValue = document.getElementById('rainValue');
const confidenceValue = document.getElementById('confidenceValue');
const summaryText = document.getElementById('summaryText');
const historyList = document.getElementById('historyList');

const monthlyRainfall = [18, 16, 12, 14, 28, 72, 118, 97, 85, 52, 26, 20];
const monthlyTemperature = [22, 25, 30, 34, 36, 32, 29, 28, 28, 27, 24, 22];
const monthlyHumidity = [58, 52, 46, 43, 44, 61, 82, 86, 80, 69, 63, 60];

const history = [
  { label: 'Mumbai • Latest', value: 'Rain expected', probability: 82, rainfall: 24.5 },
  { label: 'Pune • Monsoon', value: 'Rain likely', probability: 76, rainfall: 18.9 },
  { label: 'Delhi • Summer', value: 'No rain expected', probability: 31, rainfall: 2.4 },
];

let rainfallChart;
let temperatureChart;
let humidityChart;
let predictionTimer;
let activeRequest;
let predictionRequestId = 0;

function renderHistory() {
  historyList.innerHTML = '';

  history.slice(0, 4).forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const iconClass = entry.value.toLowerCase().includes('no') ? 'dry' : '';

    item.innerHTML = `
      <div class="history-main">
        <div class="history-pill ${iconClass}">${entry.value.toLowerCase().includes('no') ? '☀️' : '🌧️'}</div>
        <div class="history-meta">
          <strong>${entry.label}</strong>
          <span>${entry.value}</span>
        </div>
      </div>
      <div class="history-score">
        <span>${entry.probability}%</span>
        <strong>${entry.rainfall}mm</strong>
      </div>
    `;

    historyList.appendChild(item);
  });
}

function buildCharts() {
  const rainfallCtx = document.getElementById('rainfallChart');
  const temperatureCtx = document.getElementById('temperatureChart');
  const humidityCtx = document.getElementById('humidityChart');

  rainfallChart = new Chart(rainfallCtx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Rainfall (mm)',
        data: monthlyRainfall,
        backgroundColor: ['#44c7ff', '#4dbad0', '#67d7d1', '#8fe0a6', '#d3e7a3', '#ffd166', '#ff9f43', '#ff7f50', '#ff6b6b', '#70c1b3', '#9ee2ff', '#a1d6e2'],
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#b8d5eb' } },
        x: { ticks: { color: '#b8d5eb' }, grid: { display: false } }
      }
    }
  });

  temperatureChart = new Chart(temperatureCtx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Temperature (°C)',
        data: monthlyTemperature,
        borderColor: '#ffbf69',
        backgroundColor: 'rgba(255,191,105,0.18)',
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#b8d5eb' } },
        x: { ticks: { color: '#b8d5eb' }, grid: { display: false } }
      }
    }
  });

  humidityChart = new Chart(humidityCtx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Humidity (%)',
        data: monthlyHumidity,
        borderColor: '#52d7b8',
        backgroundColor: 'rgba(82,215,184,0.18)',
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#b8d5eb' } },
        x: { ticks: { color: '#b8d5eb' }, grid: { display: false } }
      }
    }
  });
}

function updateUI(result) {
  const probability = Number(result.probability) * 100;
  const displayedProbability = `${probability.toFixed(1)}%`;
  const isRain = result.prediction === 'Rain';

  resultBadge.textContent = isRain ? '🌧️ Rain likely' : '☀️ Dry spell likely';
  resultBadge.classList.toggle('status-rain', isRain);
  resultBadge.classList.toggle('status-dry', !isRain);

  predictionIcon.classList.toggle('rain', isRain);
  predictionIcon.classList.toggle('dry', !isRain);
  predictionIcon.textContent = isRain ? '☔' : '☀️';

  predictionTitle.textContent = isRain ? 'RAIN EXPECTED' : 'NO RAIN';
  predictionSubtitle.textContent = `Probability: ${displayedProbability}`;
  probabilityValue.textContent = displayedProbability;
  rainValue.textContent = `${Number(result.expectedRainfall || 0).toFixed(1)} mm`;
  confidenceValue.textContent = `${Math.round(Number(result.confidence || 0) * 100)}%`;

  summaryText.textContent = isRain
    ? `Rain is likely in ${result.location} due to high humidity, cloud cover, and a monsoon-friendly monthly pattern.`
    : `Conditions look drier today, with limited rainfall risk based on lower humidity and reduced cloud activity.`;

  history.unshift({
    label: `${result.location} • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    value: isRain ? 'Rain likely' : 'No rain expected',
    probability: Number(probability.toFixed(1)),
    rainfall: Number(result.expectedRainfall || 0)
  });

  if (history.length > 5) {
    history.pop();
  }

  renderHistory();
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    throw new Error('The server returned an empty response.');
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('The server returned invalid JSON data.');
  }
}

async function requestPrediction() {
  if (!form.checkValidity()) {
    return;
  }

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  const numericFields = [
    'temperature',
    'humidity',
    'pressure',
    'windSpeed',
    'cloudCover',
    'previousRainfall',
    'month'
  ];

  numericFields.forEach((field) => {
    const value = Number(payload[field]);
    payload[field] = Number.isFinite(value) ? value : 0;
  });

  const requestId = ++predictionRequestId;
  activeRequest?.abort();
  activeRequest = new AbortController();

  try {
    const response = await fetch('/api/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: activeRequest.signal
    });

    const result = await parseJsonResponse(response);

    if (requestId !== predictionRequestId) {
      return;
    }

    if (!response.ok) {
      throw new Error(result.details?.[0] || result.error || 'Prediction request failed');
    }

    if (!result || !result.prediction) {
      throw new Error('Prediction response was incomplete.');
    }

    updateUI(result);
  } catch (error) {
    if (error.name === 'AbortError' || requestId !== predictionRequestId) {
      return;
    }
    summaryText.textContent = `Unable to fetch the forecast: ${error.message}`;
    resultBadge.textContent = '⚠️ Check your input';
    resultBadge.classList.remove('status-rain', 'status-dry');
    resultBadge.classList.add('status-dry');
  }
}

function schedulePrediction() {
  clearTimeout(predictionTimer);
  predictionTimer = setTimeout(requestPrediction, 350);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(predictionTimer);
  requestPrediction();
});

form.addEventListener('input', (event) => {
  if (event.target.matches('input')) {
    schedulePrediction();
  }
});

form.addEventListener('change', (event) => {
  if (event.target.matches('select')) {
    schedulePrediction();
  }
});

renderHistory();
buildCharts();

requestPrediction();
