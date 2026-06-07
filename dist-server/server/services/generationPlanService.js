"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlanAdjustment = exports.generateGenerationPlan = void 0;
const database_1 = require("../database");
const MAX_RAMP_RATE = 50;
const MIN_FUEL_LIFE_FOR_FULL_POWER = 20;
const generateGenerationPlan = async (unitId, date, gridForecast) => {
    const unit = await (0, database_1.getQuery)('SELECT * FROM units WHERE id=?', [unitId]);
    if (!unit) {
        throw new Error('Unit not found');
    }
    if (unit.status !== 'operational') {
        throw new Error('Unit is not operational');
    }
    if (unit.fuelRodLife < MIN_FUEL_LIFE_FOR_FULL_POWER) {
        throw new Error('Fuel rod life too low for operation');
    }
    let hourlyLoad;
    if (gridForecast) {
        hourlyLoad = gridForecast;
    }
    else {
        const forecast = await (0, database_1.getQuery)('SELECT * FROM grid_load_forecast WHERE date=?', [date]);
        if (forecast) {
            hourlyLoad = JSON.parse(forecast.hourlyLoad || '[]');
        }
        else {
            const baseLoad = unit.power * 0.85;
            hourlyLoad = Array.from({ length: 24 }, (_, hour) => {
                const peakFactor = hour >= 8 && hour <= 12 ? 1.1 : hour >= 18 && hour <= 22 ? 1.05 : hour >= 0 && hour <= 6 ? 0.7 : 0.9;
                return Math.round(baseLoad * peakFactor);
            });
        }
    }
    const allUnits = await (0, database_1.allQuery)('SELECT * FROM units WHERE status=?', ['operational']);
    const totalCapacity = allUnits.reduce((sum, u) => sum + u.power, 0);
    const unitShare = unit.power / totalCapacity;
    const hourlyPlan = [];
    let previousPower = unit.currentPowerLevel;
    for (let hour = 0; hour < 24; hour++) {
        const gridDemand = hourlyLoad[hour];
        let targetPower = Math.round(gridDemand * unitShare);
        targetPower = Math.min(targetPower, unit.power);
        targetPower = Math.max(targetPower, unit.power * 0.3);
        const fuelFactor = unit.fuelRodLife / 100;
        targetPower = Math.round(targetPower * fuelFactor);
        const maxRampUp = previousPower + MAX_RAMP_RATE;
        const maxRampDown = previousPower - MAX_RAMP_RATE;
        targetPower = Math.min(targetPower, maxRampUp);
        targetPower = Math.max(targetPower, maxRampDown);
        const rampRate = Math.abs(targetPower - previousPower);
        previousPower = targetPower;
        hourlyPlan.push({
            hour,
            targetPower,
            rampRate
        });
    }
    const plan = {
        id: `plan_${Date.now()}`,
        unitId: unit.id,
        date,
        hourlyPlan,
        status: 'draft',
        createdAt: new Date().toISOString(),
        notes: `自动生成计划 - ${unit.unitNo}`
    };
    return plan;
};
exports.generateGenerationPlan = generateGenerationPlan;
const validatePlanAdjustment = async (planId, newHourlyPlan) => {
    const issues = [];
    const plan = await (0, database_1.getQuery)('SELECT * FROM generation_plans WHERE id=?', [planId]);
    if (!plan) {
        return { valid: false, issues: ['Plan not found'] };
    }
    const unit = await (0, database_1.getQuery)('SELECT * FROM units WHERE id=?', [plan.unitId]);
    if (!unit) {
        return { valid: false, issues: ['Unit not found'] };
    }
    let prevPower = unit.currentPowerLevel;
    for (const hourPlan of newHourlyPlan) {
        if (hourPlan.targetPower > unit.power) {
            issues.push(`小时 ${hourPlan.hour}: 目标功率超过额定功率`);
        }
        if (hourPlan.targetPower < unit.power * 0.3) {
            issues.push(`小时 ${hourPlan.hour}: 目标功率低于最低运行功率`);
        }
        if (Math.abs(hourPlan.targetPower - prevPower) > MAX_RAMP_RATE) {
            issues.push(`小时 ${hourPlan.hour}: 功率变化速率超过限制`);
        }
        prevPower = hourPlan.targetPower;
    }
    return {
        valid: issues.length === 0,
        issues
    };
};
exports.validatePlanAdjustment = validatePlanAdjustment;
