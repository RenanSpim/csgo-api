const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const data = [];

// Load and parse the CSV file once on startup
fs.createReadStream('csgo_data.csv')
    .pipe(csv())
    .on('data', (row) => {
        row.match_date = moment(row.match_date, 'YYYY-MM-DD'); // Parse date format
        data.push(row);
    })
    .on('end', () => {
        console.log('CSV file successfully processed');
    });

// Define an API endpoint to get rankings for a given date
app.get('/rankings', (req, res) => {
    const dateInput = req.query.date;
    const date = moment(dateInput, 'YYYY-MM-DD', true);

    if (!date.isValid()) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Find the closest date data entry
    const closestMatch = data.reduce((closest, entry) => {
        const entryDate = entry.match_date;
        const closestDate = closest.match_date;
        return Math.abs(entryDate - date) < Math.abs(closestDate - date) ? entry : closest;
    });

    if (!closestMatch) {
        return res.status(404).json({ error: 'No data found for the given date.' });
    }

    // Prepare the rankings response
    const rankings = {};
    for (let i = 1; i <= 50; i++) {
        rankings[`top_${i}`] = {
            team: closestMatch[`top_${i}`],
            elo: closestMatch[`top_${i}_elo`]
        };
    }

    res.json({ date: closestMatch.match_date.format('YYYY-MM-DD'), rankings });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});