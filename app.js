const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); 
});

app.get('/search/:keyword', async (req, res, next) => {
  try {
    const keyword = req.params.keyword;
    console.log(`Searching for ${keyword}...`);
    const urls = await scrapeUrls(`/search?q=${encodeURIComponent(keyword)}`);
    console.log(`Found ${urls.length} URLs.`);
    res.json(urls);
  } catch (err) {
    next(err);
  }
});

app.get('/download/:url', async (req, res, next) => {
  try {
    const url = req.params.url;
    console.log(`Downloading "${url}"...`);
    const response = await axios.head(url);
    const size = parseInt(response.headers['content-length'], 10);
    const maxChunks = 5;
    const chunkSize = Math.ceil(size / maxChunks);
    let loadedBytes = 0;
    console.log(`Downloading "${url}" of size ${size} bytes using ${maxChunks} chunks...`);
    const chunks = [];
    for (let i = 0; i < maxChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(size, (i + 1) * chunkSize) - 1;
      if (start <= end) {
        const chunkResponse = await axios.get(url, { responseType: 'arraybuffer', headers: { Range: `bytes=${start}-${end}` } });
        const chunk = Buffer.from(chunkResponse.data);
        chunks.push(chunk);
        loadedBytes += chunk.byteLength;
        const percent = (loadedBytes / size) * 100;
        console.log(`${percent.toFixed(2)}% loaded (${i+1}/${maxChunks} chunks)`);
      }
    }
    console.log(`Download complete for "${url}".`);
    res.json({ content: Buffer.concat(chunks).toString('utf8') });
  } catch (err) {
    console.error(err);
  }
});

async function scrapeUrls(path) {
  const response = await axios.get(`https://www.google.com${path}`);
  const $ = cheerio.load(response.data);
  const urls = $('a')
    .filter((_, el) => $(el).attr('href').startsWith('/url?q='))
    .map((_, el) => $(el).attr('href').substring(7).split('&')[0])
    .get();
  return urls;
}

app.listen(3000, () => console.log('Server listening on port 3000!'));