const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
require('dotenv').config();

const app = express();
        await browser.close();

        // Return the results
        res.json({ scripts });
    } catch (error) {
        console.error('An error occurred:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

// Export scripts as a text or CSV file
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});