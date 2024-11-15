const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const data = [];

const calculateWinProbability = (elo1, elo2) => 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));

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
        const entryDate = moment(entry.match_date, 'YYYY-MM-DD');
        return Math.abs(entryDate.diff(date)) < Math.abs(moment(closest.match_date, 'YYYY-MM-DD').diff(date)) ? entry : closest;
    });

    if (!closestMatch) {
        return res.status(404).json({ error: 'No data found for the given date.' });
    }

    // Prepare the rankings as an array of objects
    const rankings = [];
    for (let i = 1; i <= 50; i++) {
        const team = closestMatch[`top_${i}`];
        const elo = closestMatch[`top_${i}_elo`];
        if (team && elo) {
            rankings.push({
                team,
                elo,
                top: i
            });
        }
    }

    // Send the response
    res.json({
        date: moment(closestMatch.match_date).format('YYYY-MM-DD'),
        teams: rankings,
    });
});

app.get('/match', (req, res) => {
    const [dateInput, team1Input, team2Input] = [req.query.date, req.query.team1, req.query.team2];
    const date = moment(dateInput, 'YYYY-MM-DD', true);
    
    if (!date.isValid()) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
  
    // Find the closest match date
    const closestMatch = data.reduce((closest, entry) => {
        const entryDate = entry.match_date;
        const closestDate = closest.match_date;
        return Math.abs(entryDate - date) < Math.abs(closestDate - date) ? entry : closest;
    });
  
    if (!closestMatch) {
        return res.status(404).json({ error: 'No data found for the given date.' });
    }
  
    // Find team ELO ratings
    const team1Rank = Math.ceil((Object.values(closestMatch).findIndex(val => val === team1Input) + 1) / 2);
    const team2Rank = Math.ceil((Object.values(closestMatch).findIndex(val => val === team2Input) + 1) / 2);
    
    const team1Elo = closestMatch[`top_${team1Rank}_elo`];
    const team2Elo = closestMatch[`top_${team2Rank}_elo`];
  
    if (!team1Elo || !team2Elo) {
        return res.status(404).json({ error: 'Team ELO not found for the given teams.' });
    }
  
    // Calculate win probabilities
    const team1WinProbability = calculateWinProbability(team1Elo, team2Elo);
    const team2WinProbability = 1 - team1WinProbability;
  
    // Respond with the calculated odds
    res.json({
        date: closestMatch.match_date.format('YYYY-MM-DD'),
        team1: {
            name: team1Input,
            elo: team1Elo,
            win_probability: team1WinProbability
        },
        team2: {
            name: team2Input,
            elo: team2Elo,
            win_probability: team2WinProbability
        }
    });
  });

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});