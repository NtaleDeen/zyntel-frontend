// index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/', (req, res) => {
  res.send('✅ Zyntel backend is running.');
});

app.post('/api/lab', async (req, res) => {
  const { hospital_id, test_name, time_in, time_out, expected_time } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO LabEncounters (hospital_id, test_name, time_in, time_out, expected_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [hospital_id, test_name, time_in, time_out, expected_time]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lab/:hospital_id', async (req, res) => {
  try {
    const { hospital_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM LabEncounters WHERE hospital_id = $1 ORDER BY created_at DESC',
      [hospital_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
