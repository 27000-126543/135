"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestReadings = exports.getRadiationTrend = exports.updateEvacuationProgress = exports.initiateEvacuation = exports.checkRadiationLevels = void 0;
const database_1 = require("../database");
const RADIATION_THRESHOLDS = {
    plant: { warning: 50, danger: 80, emergency: 100 },
    perimeter: { warning: 5, danger: 8, emergency: 10 },
    surrounding: { warning: 0.5, danger: 0.8, emergency: 1 }
};
const EVACUATION_ZONES = {
    'plant': ['反应堆厂房', '汽轮机厂房', '核辅助厂房', '燃料操作区'],
    'perimeter': ['厂区办公楼', '食堂', '培训中心', '仓库区'],
    'surrounding': ['周边居民区1', '周边居民区2', '周边商业区', '周边学校']
};
const checkRadiationLevels = async (reading) => {
    const thresholds = RADIATION_THRESHOLDS[reading.locationType];
    let level = null;
    if (reading.doseRate >= thresholds.emergency) {
        level = 'emergency';
    }
    else if (reading.doseRate >= thresholds.danger) {
        level = 'danger';
    }
    else if (reading.doseRate >= thresholds.warning) {
        level = 'warning';
    }
    if (level) {
        const alarm = {
            id: `rad_alarm_${Date.now()}`,
            unitId: 'all',
            type: 'radiation',
            level,
            message: `辐射剂量${level === 'warning' ? '预警' : level === 'danger' ? '危险' : '紧急'}: ${reading.location} 当前值 ${reading.doseRate.toFixed(4)} ${reading.unit}，阈值 ${thresholds[level]}`,
            value: reading.doseRate,
            threshold: thresholds[level],
            timestamp: new Date().toISOString(),
            acknowledged: false
        };
        await (0, database_1.runQuery)('INSERT INTO alarms (id, unitId, type, level, message, value, threshold, timestamp, acknowledged) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [alarm.id, alarm.unitId, alarm.type, alarm.level, alarm.message, alarm.value, alarm.threshold, alarm.timestamp, 0]);
        return alarm;
    }
    return null;
};
exports.checkRadiationLevels = checkRadiationLevels;
const initiateEvacuation = async (alarm) => {
    const affectedZones = EVACUATION_ZONES['plant'];
    const personnelCount = affectedZones.length * 25;
    const evacuation = {
        id: `evac_${Date.now()}`,
        alarmId: alarm.id,
        status: 'initiated',
        affectedZones,
        personnelCount,
        safePersonnelCount: 0,
        startTime: new Date().toISOString()
    };
    await (0, database_1.runQuery)('INSERT INTO evacuation_status (id, alarmId, status, affectedZones, personnelCount, safePersonnelCount, startTime) VALUES (?, ?, ?, ?, ?, ?, ?)', [evacuation.id, evacuation.alarmId, evacuation.status, JSON.stringify(evacuation.affectedZones), evacuation.personnelCount, evacuation.safePersonnelCount, evacuation.startTime]);
    return evacuation;
};
exports.initiateEvacuation = initiateEvacuation;
const updateEvacuationProgress = async (evacuationId, safeCount) => {
    const evacuation = await (0, database_1.runQuery)('SELECT * FROM evacuation_status WHERE id=?', [evacuationId]);
    if (!evacuation)
        return;
    let status = 'in_progress';
    let endTime = null;
    if (safeCount >= evacuation.personnelCount) {
        status = 'completed';
        endTime = new Date().toISOString();
    }
    await (0, database_1.runQuery)('UPDATE evacuation_status SET safePersonnelCount=?, status=?, endTime=? WHERE id=?', [safeCount, status, endTime, evacuationId]);
};
exports.updateEvacuationProgress = updateEvacuationProgress;
const getRadiationTrend = async (location, hours = 24) => {
    const readings = await (0, database_1.runQuery)('SELECT * FROM radiation_readings WHERE location=? AND timestamp >= ? ORDER BY timestamp', [location, new Date(Date.now() - hours * 3600000).toISOString()]);
    return readings;
};
exports.getRadiationTrend = getRadiationTrend;
const getLatestReadings = async () => {
    const locations = ['反应堆厂房', '汽轮机厂房', '厂区边界1', '厂区边界2', '周边居民区1', '周边居民区2'];
    const readings = [];
    for (const location of locations) {
        const latest = await (0, database_1.runQuery)('SELECT * FROM radiation_readings WHERE location=? ORDER BY timestamp DESC LIMIT 1', [location]);
        if (latest && latest.length > 0) {
            readings.push(latest[0]);
        }
    }
    return readings;
};
exports.getLatestReadings = getLatestReadings;
