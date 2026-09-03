import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const stressLatency = new Trend('stress_pipeline_latency');
const stressSuccessRate = new Rate('stress_success_rate');

export const options = {
  stages: [
    { duration: '30s', target: 1 },  // Baseline single user
    { duration: '30s', target: 5 },  // Step up low concurrency
    { duration: '30s', target: 10 }, // Step up medium concurrency
    { duration: '30s', target: 20 }, // Step up high concurrency
    { duration: '30s', target: 0 },  // Ramp down / recovery
  ],
  thresholds: {
    http_req_failed: ['rate<0.15'], // Allow up to 15% rate error under stress
    stress_success_rate: ['rate>0.85'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'mock-token';
const pdfFixture = open('../fixtures/text-layer.pdf', 'b');

export default function () {
  const data = {
    pdfs: http.file(pdfFixture, 'text-layer.pdf', 'application/pdf'),
  };

  const params = {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/pdf/import`, data, params);
  const latency = Date.now() - startTime;

  stressLatency.add(latency);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  stressSuccessRate.add(success);
  sleep(2);
}
