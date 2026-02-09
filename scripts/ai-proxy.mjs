import http from 'node:http';

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const TARGET_ORIGIN = process.env.AI_PROXY_TARGET_ORIGIN || 'https://api.openai.com';
const API_KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';

/**
 * @param {http.ServerResponse} res
 */
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, OpenAI-Beta, X-Requested-With',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * @param {http.IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/v1/')) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found. This proxy only forwards /v1/* paths.' }));
      return;
    }

    const body = await readBody(req);
    /** @type {Record<string, string>} */
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value !== 'string') continue;
      if (key.toLowerCase() === 'host') continue;
      if (key.toLowerCase() === 'content-length') continue;
      headers[key] = value;
    }
    if (API_KEY && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${API_KEY}`;
    }

    const target = new URL(url.pathname + url.search, TARGET_ORIGIN);
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body.length ? body : undefined,
    });

    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'content-encoding') return;
      if (lower === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    setCors(res);

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (error) {
    res.statusCode = 500;
    setCors(res);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(error instanceof Error ? error.message : error) }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    [
      'AI proxy running.',
      `Base URL: http://${HOST}:${PORT}/v1`,
      `Upstream: ${TARGET_ORIGIN}/v1`,
      API_KEY ? 'Auth: OPENAI_API_KEY set' : 'Auth: OPENAI_API_KEY not set (client must send Authorization)',
    ].join('\n'),
  );
});

