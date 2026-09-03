import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const aiGenDuration = new Trend('ai_gen_duration');
const aiGenSuccessRate = new Rate('ai_gen_success_rate');

export const options = {
  vus: parseInt(__ENV.VUS || '1'),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.10'], // error rate < 10% for external AI
    ai_gen_success_rate: ['rate>0.90'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const payload = JSON.stringify({
    topic: 'Vật lý 12 - Dao động cơ',
    grade: '12',
    subject: 'Vật lý',
    quantity: 5,
    format: 'Trắc nghiệm',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/ai/create`, payload, params);
  const duration = Date.now() - startTime;

  aiGenDuration.add(duration);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'has generated assignment': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.data !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  aiGenSuccessRate.add(success);
  sleep(2);
}
