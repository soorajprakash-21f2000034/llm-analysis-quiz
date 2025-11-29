require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const { chromium } = require('playwright');

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const EXPECTED_SECRET = process.env.SECRET;
const EMAIL = process.env.EMAIL;

// helper
function jsonRes(res, status, obj) {
  res.status(status).json(obj);
}

app.post('/quiz-hook', async (req, res) => {
  if (!req.is('application/json')) {
    return jsonRes(res, 400, { error: 'Invalid JSON or content-type' });
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return jsonRes(res, 400, { error: 'Invalid JSON body' });
  }

  const { email, secret, url } = payload;

  if (!email || !secret || !url) {
    return jsonRes(res, 400, { error: 'Missing email, secret or url' });
  }

  if (secret !== EXPECTED_SECRET) {
    return jsonRes(res, 403, { error: 'Invalid secret' });
  }

  jsonRes(res, 200, { received: true, status: 'processing' });

  try {
    await solveQuiz(url, email, secret);
    console.log('Quiz handled:', url);
  } catch (err) {
    console.error('Quiz error:', err);
  }
});

// MAIN QUIZ SOLVER
async function solveQuiz(url, email, secret) {
  const deadline = Date.now() + 170000;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });

  const pageText = await page.evaluate(() => document.body.innerText);

  const submitUrl = await findSubmitUrl(page);
  if (!submitUrl) {
    throw new Error('No submit URL found');
  }

  const fileUrl = await page.evaluate(() => {
    const anchors = [...document.querySelectorAll('a')];
    for (const a of anchors) {
      if (a.href.match(/\.(csv|json|pdf)$/i)) {
        return a.href;
      }
    }
    return null;
  });

  let answer = null;

  if (fileUrl && fileUrl.endsWith('.csv')) {
    const csv = await (await fetch(fileUrl)).text();
    answer = sumColumn(csv);
  } else {
    answer = 'unable_to_solve';
  }

  const payload = { email, secret, url, answer };
  await postWithTimeout(submitUrl, payload, deadline);

  await browser.close();
}

function sumColumn(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  let idx = headers.findIndex(h => h.trim().toLowerCase() === 'value');

  if (idx === -1) idx = 1;

  let sum = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    sum += parseFloat(cols[idx]) || 0;
  }
  return sum;
}

async function findSubmitUrl(page) {
  return page.evaluate(() => {
    const anchors = [...document.querySelectorAll('a')];
    for (const a of anchors) {
      if (/submit/i.test(a.innerText) || /submit/i.test(a.href)) return a.href;
    }

    const forms = [...document.querySelectorAll('form')];
    for (const f of forms) if (f.action) return f.action;

    const m = document.body.innerText.match(/https?:\/\/\S+/);
    return m ? m[0] : null;
  });
}

async function postWithTimeout(url, payload, deadline) {
  const now = Date.now();
  if (now > deadline) throw new Error('Deadline exceeded');

  const ms = deadline - now - 1000;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  });

  clearTimeout(id);
  const json = await resp.json().catch(() => null);
  console.log('Submit response:', json);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
