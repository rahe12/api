const express = require('express');
const Joi = require('joi');
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Validation schema
const timetableSchema = Joi.object({
  course: Joi.string().min(3).max(100).required(),
  day: Joi.string().valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday').required(),
  start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(), // HH:mm format
  end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
});

// Add timetable (admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { error, value } = timetableSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { course, day, start_time, end_time } = value;

    const result = await pool.query(
      'INSERT INTO timetable (course, day, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [course, day, start_time, end_time]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// List all timetable entries (any authenticated user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM timetable ORDER BY day, start_time');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
