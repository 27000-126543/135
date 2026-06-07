"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.allQuery = exports.getQuery = exports.runQuery = exports.getDb = exports.initDatabase = void 0;
const sqlite3 = __importStar(require("sqlite3"));
const path = __importStar(require("path"));
const dbPath = path.join(__dirname, 'nuclear_monitor.db');
const db = new sqlite3.Database(dbPath);
const initDatabase = () => {
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
exports.initDatabase = initDatabase;
const getDb = () => db;
exports.getDb = getDb;
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};
exports.runQuery = runQuery;
const getQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
};
exports.getQuery = getQuery;
const allQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
exports.allQuery = allQuery;
