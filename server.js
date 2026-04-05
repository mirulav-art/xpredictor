const express = require("express");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
const PORT = 80;
const CACHE_DIR = path.join(__dirname, "cache");

// Cream folderul cache daca nu exista
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname, { extensions: ["html"] }));

app.get("/", (req, res) => {
  res.redirect("/football-matches.html");
});

// GET /cache/:key - citeste din cache
app.get("/cache/:key", (req, res) => {
  const file = path.join(CACHE_DIR, req.params.key + ".json");
  if (!fs.existsSync(file)) return res.status(404).json({ error: "not found" });
  // TTL 30 minute pentru cache-ul listei de meciuri
  if (req.params.key.startsWith("matches_")) {
    const age = Date.now() - fs.statSync(file).mtimeMs;
    if (age > 30 * 60 * 1000) return res.status(404).json({ error: "expired" });
  }
  res.sendFile(file);
});

// POST /cache/:key - salveaza in cache
app.post("/cache/:key", (req, res) => {
  const file = path.join(CACHE_DIR, req.params.key + ".json");
  fs.writeFileSync(file, JSON.stringify(req.body));
  res.json({ ok: true });
});

// DELETE /cache/:key - sterge din cache
app.delete("/cache/:key", (req, res) => {
  const file = path.join(CACHE_DIR, req.params.key + ".json");
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// GET /img-proxy?url=... - proxy imagini (evita blocarea hotlinking de la Sofascore)
app.get("/img-proxy", (req, res) => {
  const url = req.query.url;
  if (!url || (!url.startsWith("https://api.sofascore.app/") && !url.startsWith("https://www.sofascore.com/"))) {
    return res.status(400).end();
  }
  const options = {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Referer": "https://www.sofascore.com/",
      "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
    }
  };
  https.get(url, options, (upstream) => {
    res.setHeader("Content-Type", upstream.headers["content-type"] || "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    upstream.pipe(res);
  }).on("error", () => res.status(502).end());
});

app.listen(PORT, () => {
  console.log(`Server pornit pe http://localhost:${PORT}`);
});
