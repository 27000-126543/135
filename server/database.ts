import * as sqlite3 from 'sqlite3';
import * as path from 'path';

const dbPath = path.join(__dirname, 'nuclear_monitor.db');
const db = new sqlite3.Database(dbPath);

export const initDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      unitNo TEXT UNIQUE,
      power REAL,
      reactorType TEXT,
      currentPowerLevel REAL,
      fuelRodLife REAL,
      status TEXT,
      operatingHours REAL,
      lastMaintenanceDate TEXT,
      nextMaintenanceDate TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS generation_plans (
      id TEXT PRIMARY KEY,
      unitId TEXT,
      date TEXT,
      hourlyPlan TEXT,
      status TEXT,
      approvedBy TEXT,
      approvedAt TEXT,
      createdAt TEXT,
      notes TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS realtime_data (
      id TEXT PRIMARY KEY,
      unitId TEXT,
      timestamp TEXT,
      neutronFlux REAL,
      coolantTemp REAL,
      coolantPressure REAL,
      mainPumpSpeed REAL,
      controlRodPosition REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS alarms (
      id TEXT PRIMARY KEY,
      unitId TEXT,
      type TEXT,
      level TEXT,
      message TEXT,
      value REAL,
      threshold REAL,
      timestamp TEXT,
      acknowledged INTEGER,
      autoActionTaken TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT,
      unitId TEXT,
      category TEXT,
      criticalityLevel INTEGER,
      operatingHours REAL,
      lastMaintenance TEXT,
      nextMaintenance TEXT,
      status TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS maintenance_orders (
      id TEXT PRIMARY KEY,
      equipmentId TEXT,
      unitId TEXT,
      description TEXT,
      priority TEXT,
      assignedTeam TEXT,
      parts TEXT,
      status TEXT,
      createdAt TEXT,
      startedAt TEXT,
      completedAt TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      partName TEXT,
      partNo TEXT,
      quantity INTEGER,
      minStock INTEGER,
      maxStock INTEGER,
      location TEXT,
      lastUpdated TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS radiation_readings (
      id TEXT PRIMARY KEY,
      location TEXT,
      locationType TEXT,
      timestamp TEXT,
      doseRate REAL,
      unit TEXT,
      alarmThreshold REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS evacuation_status (
      id TEXT PRIMARY KEY,
      alarmId TEXT,
      status TEXT,
      affectedZones TEXT,
      personnelCount INTEGER,
      safePersonnelCount INTEGER,
      startTime TEXT,
      endTime TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT,
      employeeNo TEXT,
      skills TEXT,
      maxHoursPerWeek INTEGER,
      currentHoursThisWeek INTEGER,
      status TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      date TEXT,
      shiftType TEXT,
      employeeIds TEXT,
      requiredSkills TEXT,
      startTime TEXT,
      endTime TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS shift_swap_requests (
      id TEXT PRIMARY KEY,
      employeeId TEXT,
      fromShiftId TEXT,
      toShiftId TEXT,
      requestedToEmployeeId TEXT,
      reason TEXT,
      status TEXT,
      approvedBy TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS statistics (
      id TEXT PRIMARY KEY,
      unitId TEXT,
      period TEXT,
      startDate TEXT,
      endDate TEXT,
      totalGeneration REAL,
      loadFactor REAL,
      unplannedOutageCount INTEGER,
      avgRadiationDose REAL,
      maxRadiationDose REAL,
      equipmentAvailability REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      role TEXT,
      name TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS grid_load_forecast (
      id TEXT PRIMARY KEY,
      date TEXT,
      hourlyLoad TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      type TEXT,
      refId TEXT,
      requestedBy TEXT,
      requestedAt TEXT,
      status TEXT,
      approvedBy TEXT,
      approvedAt TEXT,
      comments TEXT
    )`);
  });
};

export const getDb = () => db;

export const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const allQuery = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};
