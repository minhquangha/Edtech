import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Custom Metrics
const pdfExtractionDuration = new Trend('pdf_extraction_duration');
const pdfImportSuccessRate = new Rate('pdf_import_success_rate');

export const options = {
  scenarios: {
    small_pdf: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 5,
      maxDuration: '1m',
      exec: 'testSmallPdf',
    },
    medium_pdf: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 3,
      maxDuration: '1m',
      exec: 'testMediumPdf',
      startTime: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'], // error rate < 5%
    pdf_import_success_rate: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'mock-token';

// Load fixture binaries (k6 open bin)
const smallPdfBin = open('../fixtures/text-layer.pdf', 'b');
const mediumPdfBin = open('../fixtures/1. Hàn Thuyên - Bắc Ninh-1.pdf', 'b');

function uploadPdf(pdfBuffer, filename) {
  const data = {
    pdfs: http.file(pdfBuffer, filename, 'application/pdf'),
  };

  const params = {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/pdf/import`, data, params);
  const duration = Date.now() - startTime;

  pdfExtractionDuration.add(duration);
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'has data field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.data !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  pdfImportSuccessRate.add(success);
}

export function testSmallPdf() {
  uploadPdf(smallPdfBin, 'text-layer.pdf');
  sleep(1);
}

export function testMediumPdf() {
  uploadPdf(mediumPdfBin, '1. Hàn Thuyên - Bắc Ninh-1.pdf');
  sleep(1);
}

export default function () {
  testSmallPdf();
}
