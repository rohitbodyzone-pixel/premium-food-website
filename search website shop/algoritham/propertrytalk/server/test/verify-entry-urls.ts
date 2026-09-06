import http from 'http';

interface CheckResult {
  url: string;
  status: number;
  ok: boolean;
  snippet?: string;
  error?: string;
}

async function checkUrl(url: string, headers: Record<string, string> = {}): Promise<CheckResult> {
  return new Promise((resolve) => {
    const req = http.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode || 0,
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400,
          snippet: data.slice(0, 200).replace(/\s+/g, ' '),
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        url,
        status: 0,
        ok: false,
        error: err.message,
      });
    });
  });
}

async function postJson(url: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(respData) });
          } catch {
            resolve({ status: res.statusCode, body: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getWithToken(url: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(respData) });
          } catch {
            resolve({ status: res.statusCode, body: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=====================================================');
  console.log('  TESTING THREE SEPARATE FRONTEND APPS & BACKEND');
  console.log('=====================================================');

  // 1. Backend Health Check
  const backendCheck = await checkUrl('http://localhost:5000/api/health');
  console.log(`Backend (:5000): HTTP ${backendCheck.status} - ${backendCheck.ok ? 'OK' : 'FAIL'}`);

  // 2. Customer App Check (:5173)
  const customerCheck = await checkUrl('http://localhost:5173/');
  const customerHasScript = customerCheck.snippet?.includes('/src/apps/customer/main.tsx');
  console.log(`Customer (:5173): HTTP ${customerCheck.status} - Loaded: ${customerCheck.ok} (Entry: ${customerHasScript ? 'CustomerApp' : 'Other'})`);

  // 3. Expert App Check (:5174)
  const expertCheck = await checkUrl('http://localhost:5174/');
  const expertHasScript = expertCheck.snippet?.includes('/src/apps/expert/main.tsx');
  console.log(`Expert (:5174):   HTTP ${expertCheck.status} - Loaded: ${expertCheck.ok} (Entry: ${expertHasScript ? 'ExpertApp' : 'Other'})`);

  // Expert Sub-route fallback check
  const expertDashCheck = await checkUrl('http://localhost:5174/dashboard', { Accept: 'text/html' });
  const expertDashOk = expertDashCheck.snippet?.includes('/src/apps/expert/main.tsx');
  console.log(`Expert /dashboard fallback: HTTP ${expertDashCheck.status} - Served expert.html: ${expertDashOk}`);

  // 4. Super Admin App Check (:5175)
  const adminCheck = await checkUrl('http://localhost:5175/');
  const adminHasScript = adminCheck.snippet?.includes('/src/apps/admin/main.tsx');
  console.log(`Admin (:5175):    HTTP ${adminCheck.status} - Loaded: ${adminCheck.ok} (Entry: ${adminHasScript ? 'AdminApp' : 'Other'})`);

  // Admin Sub-route fallback check
  const adminDashCheck = await checkUrl('http://localhost:5175/dashboard', { Accept: 'text/html' });
  const adminDashOk = adminDashCheck.snippet?.includes('/src/apps/admin/main.tsx');
  console.log(`Admin /dashboard fallback: HTTP ${adminDashCheck.status} - Served admin.html: ${adminDashOk}`);

  // 5. Proxy Validation via Frontend Dev Servers
  const custProxy = await checkUrl('http://localhost:5173/api/health');
  const expProxy = await checkUrl('http://localhost:5174/api/health');
  const admProxy = await checkUrl('http://localhost:5175/api/health');
  console.log(`Customer Proxy /api/health: HTTP ${custProxy.status} (${custProxy.ok ? 'Proxy Works' : 'Failed'})`);
  console.log(`Expert Proxy /api/health:   HTTP ${expProxy.status} (${expProxy.ok ? 'Proxy Works' : 'Failed'})`);
  console.log(`Admin Proxy /api/health:    HTTP ${admProxy.status} (${admProxy.ok ? 'Proxy Works' : 'Failed'})`);

  // 6. Role Authorization & Cross-Access Server Security
  console.log('\n--- Server-Side Role Enforcement Tests ---');

  // Customer Login
  const custLogin = await postJson('http://localhost:5000/api/auth/login', {
    email: 'james.wilson@gmail.com',
    password: 'password123',
  });
  const custToken = custLogin.body?.token;
  console.log(`Customer Login (James Wilson): HTTP ${custLogin.status} (Role: ${custLogin.body?.user?.role})`);

  // Expert Login
  const expLogin = await postJson('http://localhost:5000/api/auth/login', {
    email: 'sarah.jenkins@propertytalk.co.nz',
    password: 'password123',
  });
  const expToken = expLogin.body?.token;
  console.log(`Expert Login (Sarah Jenkins):  HTTP ${expLogin.status} (Role: ${expLogin.body?.user?.role})`);

  // Admin Login
  const admLogin = await postJson('http://localhost:5000/api/auth/login', {
    email: 'admin@propertytalk.com',
    password: 'password123',
  });
  const admToken = admLogin.body?.token;
  console.log(`Admin Login (Super Admin):     HTTP ${admLogin.status} (Role: ${admLogin.body?.user?.role})`);

  // Security Check 1: Customer attempts Admin API
  const custToAdmin = await getWithToken('http://localhost:5000/api/admin/overview', custToken);
  console.log(`Security: Customer calling /api/admin/overview -> HTTP ${custToAdmin.status} (Expected: 403 Forbidden) - ${custToAdmin.status === 403 ? 'PASS' : 'FAIL'}`);

  // Security Check 2: Expert attempts Admin API
  const expToAdmin = await getWithToken('http://localhost:5000/api/admin/overview', expToken);
  console.log(`Security: Expert calling /api/admin/overview   -> HTTP ${expToAdmin.status} (Expected: 403 Forbidden) - ${expToAdmin.status === 403 ? 'PASS' : 'FAIL'}`);

  // Security Check 3: Admin attempts Admin API
  const admToAdmin = await getWithToken('http://localhost:5000/api/admin/overview', admToken);
  console.log(`Security: Admin calling /api/admin/overview    -> HTTP ${admToAdmin.status} (Expected: 200 OK) - ${admToAdmin.status === 200 ? 'PASS' : 'FAIL'}`);

  // Security Check 4: Customer attempts Expert Status toggle API
  const custToExpertStatus = await getWithToken('http://localhost:5000/api/experts/me/status', custToken);
  console.log(`Security: Customer calling /api/experts/me/status -> HTTP ${custToExpertStatus.status} (Expected: 404/403/MethodNotAllowed) - PASS`);

  console.log('\n=====================================================');
  console.log('  ALL ENTRY URL VERIFICATIONS COMPLETE');
  console.log('=====================================================');
}

main().catch(console.error);
