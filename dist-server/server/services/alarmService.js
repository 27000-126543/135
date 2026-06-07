"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeProtectionAction = exports.checkAlarms = void 0;
const database_1 = require("../database");
const THRESHOLDS = {
    neutron_flux: { warning: 1.2e13, danger: 1.5e13, emergency: 2e13 },
    coolant_temp: { warning: 315, danger: 325, emergency: 335 },
    coolant_pressure: { warning: 165, danger: 170, emergency: 175 },
    main_pump: { warning: 1600, danger: 1650, emergency: 1700 }
};
const checkAlarms = async (data) => {
    const checks = [
        { type: 'neutron_flux', value: data.neutronFlux },
        { type: 'coolant_temp', value: data.coolantTemp },
        { type: 'coolant_pressure', value: data.coolantPressure },
        { type: 'main_pump', value: data.mainPumpSpeed }
    ];
    for (const check of checks) {
        const threshold = THRESHOLDS[check.type];
        let level = null;
        if (check.value >= threshold.emergency) {
            level = 'emergency';
        }
        else if (check.value >= threshold.danger) {
            level = 'danger';
        }
        else if (check.value >= threshold.warning) {
            level = 'warning';
        }
        if (level) {
            const alarm = {
                id: `alarm_${Date.now()}_${check.type}`,
                unitId: data.unitId,
                type: check.type,
                level,
                message: getAlarmMessage(check.type, level, check.value, threshold[level]),
                value: check.value,
                threshold: threshold[level],
                timestamp: new Date().toISOString(),
                acknowledged: false
            };
            await (0, database_1.runQuery)('INSERT INTO alarms (id, unitId, type, level, message, value, threshold, timestamp, acknowledged) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [alarm.id, alarm.unitId, alarm.type, alarm.level, alarm.message, alarm.value, alarm.threshold, alarm.timestamp, 0]);
            return alarm;
        }
    }
    return null;
};
exports.checkAlarms = checkAlarms;
const getAlarmMessage = (type, level, value, threshold) => {
    const typeNames = {
        neutron_flux: '中子通量',
        coolant_temp: '冷却剂温度',
        coolant_pressure: '冷却剂压力',
        main_pump: '主泵转速',
        radiation: '辐射剂量'
    };
    const levelNames = {
        warning: '预警',
        danger: '危险',
        emergency: '紧急'
    };
    return `${typeNames[type]}${levelNames[level]}: 当前值 ${value.toFixed(2)}，阈值 ${threshold}`;
};
const executeProtectionAction = async (unitId, alarm) => {
    let action = '';
    let controlRodInsertion = 0;
    switch (alarm.type) {
        case 'neutron_flux':
            if (alarm.level === 'emergency') {
                action = '紧急停堆 - 控制棒快速插入';
                controlRodInsertion = 100;
            }
            else if (alarm.level === 'danger') {
                action = '控制棒部分插入 - 降低功率';
                controlRodInsertion = 30;
            }
            else {
                action = '控制棒微调 - 稳定中子通量';
                controlRodInsertion = 10;
            }
            break;
        case 'coolant_temp':
        case 'coolant_pressure':
            if (alarm.level === 'emergency') {
                action = '紧急停堆 - 启动应急冷却系统';
                controlRodInsertion = 100;
            }
            else {
                action = '增加冷却剂流量，降低功率';
                controlRodInsertion = 20;
            }
            break;
        case 'main_pump':
            if (alarm.level === 'emergency') {
                action = '停泵并启动备用泵，控制棒插入';
                controlRodInsertion = 50;
            }
            else {
                action = '降低主泵转速，降低功率';
                controlRodInsertion = 15;
            }
            break;
        default:
            action = '控制棒插入';
            controlRodInsertion = 25;
    }
    await (0, database_1.runQuery)('UPDATE alarms SET autoActionTaken=? WHERE id=?', [action, alarm.id]);
    return {
        action,
        newControlRodPosition: controlRodInsertion
    };
};
exports.executeProtectionAction = executeProtectionAction;
