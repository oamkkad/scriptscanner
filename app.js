const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core'); // Use puppeteer-core instead of puppeteer
require('dotenv').config();

const app = express();
// Parse PORT as an integer, fallback to 3000 if invalid
const rawPort = process.env.PORT;
const PORT = !isNaN(parseInt(rawPort, 10)) ? parseInt(rawPort, 10) : 3000;

console.log(`Raw PORT value: ${rawPort}`);
console.log(`Using port: ${PORT}`);
console.log(`Is PORT numeric? ${!isNaN(PORT)}`);

// Middleware to parse JSON requests
app.use(bodyParser.json());



// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Root route: Serve a simple HTML form for user input
app.get('/', (req, res) => {
    res.send(`
        <h1>Script Scanner</h1>
        <form id="urlForm">
            <label for="url">Enter URL:</label>
            <input type="text" id="url" name="url" placeholder="https://example.com" required />
            <button type="submit">Scan Scripts</button>
        </form>
        <pre id="result"></pre>

        <!-- Download Button -->
        <button id="downloadBtn" style="display: none;">Download Scripts</button>

        <script>
            let scannedScripts = []; // Store the scanned scripts

            document.getElementById('urlForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const url = document.getElementById('url').value;
                const resultElement = document.getElementById('result');
                const downloadBtn = document.getElementById('downloadBtn');

                // Reset UI
                resultElement.textContent = 'Scanning...';
                downloadBtn.style.display = 'none'; // Hide download button initially

                try {
                    const response = await fetch('/scan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url })
                    });
                    const data = await response.json();

                    if (response.ok) {
                        scannedScripts = data.scripts; // Store the scripts
                        resultElement.textContent = JSON.stringify(scannedScripts, null, 2);

                        console.log('Scripts scanned successfully:', scannedScripts); // Debugging statement

                        // Show the download button after scanning
                        downloadBtn.style.display = 'inline';
                        console.log('Download button should now be visible.'); // Debugging statement
                    } else {
                        resultElement.textContent = \`Error: \${data.error}\`;
                    }
                } catch (error) {
                    resultElement.textContent = \`Error: \${error.message}\`;
                }
            });

            // Handle download button click
            document.getElementById('downloadBtn').addEventListener('click', () => {
                fetch('/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scripts: scannedScripts })
                })
                .then(response => response.blob())
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'scripts.txt'; // File name
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                })
                .catch(error => console.error('Download error:', error));
            });
        </script>
    `);
});

// API endpoint to scan scripts on a given URL
app.post('/scan', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    let browser;
    try {
        // Verify the Chromium binary exists
        const fs = require('fs');
        const chromiumPath = '/usr/bin/chromium-browser';
        if (!fs.existsSync(chromiumPath)) {
            return res.status(500).json({ error: 'Chromium binary not found at /usr/bin/chromium-browser' });
        }

        console.log('Launching browser...');
        browser = await puppeteer.launch({
            executablePath: chromiumPath, // Path to Chromium on Render
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for security in containerized environments
        });

        console.log('Opening new page...');
        const page = await browser.newPage();

        // Set custom User-Agent to bypass bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36');

        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2' });

        console.log('Extracting scripts...');
        const scripts = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('script'), script => {
                return {
                    src: script.src || 'Inline Script',
                    type: script.type || 'text/javascript',
                    async: script.async || false,
                    defer: script.defer || false
                };
            });
        });

        console.log('Closing browser...');
        await browser.close();

        // Return the results
        res.json({ scripts });
    } catch (error) {
        console.error('An error occurred:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) {
            await browser.close().catch(err => console.error('Failed to close browser:', err));
        }
    }
});

// Export scripts as a text file
app.post('/export', (req, res) => {
    const { scripts } = req.body;

    console.log('Received scripts for export:', scripts); // Debugging statement

    if (!scripts || scripts.length === 0) {
        return res.status(400).json({ error: 'No scripts to export' });
    }

    // Format the scripts as text
    const textContent = scripts
        .map((script, index) => {
            return `Script ${index + 1}:\n` +
                   `  Source: ${script.src}\n` +
                   `  Type: ${script.type}\n` +
                   `  Async: ${script.async}\n` +
                   `  Defer: ${script.defer}\n`;
        })
        .join('\n');

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=scripts.txt');

    // Send the file content
    res.send(textContent);
});

// Start the server (only one call to app.listen)
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});