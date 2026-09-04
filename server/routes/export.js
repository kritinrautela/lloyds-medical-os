const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { generateProtectedExcel } = require('../exportExcel');

const upload = multer({ dest: path.join(__dirname, '../data/uploads') });

// GET /api/export/excel (Download password-protected encrypted Excel file)
router.get('/excel', async (req, res) => {
  try {
    const { password } = req.query;
    const excelBuffer = await generateProtectedExcel(password);

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `Lloyds_Clinic_PNG_Protected_Backup_${todayStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(excelBuffer);
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/export/backup-db (Direct SQLite file download for USB backup)
router.get('/backup-db', (req, res) => {
  try {
    const dbPath = path.join(__dirname, '../data/hospital.db');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, message: 'Database file not found' });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `hospital_backup_${todayStr}.db`;

    res.download(dbPath, filename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/export/restore-db (Restore database from uploaded file)
router.post('/restore-db', upload.single('db_file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const targetDbPath = path.join(__dirname, '../data/hospital.db');
    const backupDbPath = path.join(__dirname, `../data/hospital_pre_restore_${Date.now()}.db`);

    // Safety backup of existing db
    if (fs.existsSync(targetDbPath)) {
      fs.copyFileSync(targetDbPath, backupDbPath);
    }

    // Overwrite with uploaded db
    fs.copyFileSync(req.file.path, targetDbPath);
    fs.unlinkSync(req.file.path); // remove temp upload

    res.json({
      success: true,
      message: 'Database successfully restored from backup! Please restart or refresh the page.'
    });
  } catch (err) {
    console.error('Restore DB error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
