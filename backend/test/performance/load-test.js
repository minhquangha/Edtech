import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// E2E Pipeline Metrics
const e2ePipelineLatency = new Trend('e2e_pipeline_latency');
const e2eSuccessRate = new Rate('e2e_success_rate');

export const options = {
  vus: parseInt(__ENV.VUS || '5'),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<15000'], // Initial baseline expectation
    e2e_success_rate: ['rate>0.90'],
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

  e2ePipelineLatency.add(latency);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'contains assignment data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.data !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  e2eSuccessRate.add(success);

  // Think time between concurrent user requests to model real usage
  sleep(3);
}
