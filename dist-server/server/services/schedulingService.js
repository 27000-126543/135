"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateShiftSwap = exports.generateWeeklySchedule = void 0;
const database_1 = require("../database");
const SHIFT_HOURS = {
    morning: { start: '08:00', end: '16:00', hours: 8 },
    afternoon: { start: '16:00', end: '00:00', hours: 8 },
    night: { start: '00:00', end: '08:00', hours: 8 }
};
const SKILL_REQUIREMENTS = {
    morning: ['reactor_operator', 'electrical', 'mechanical'],
    afternoon: ['reactor_operator', 'electrical', 'mechanical'],
    night: ['reactor_operator', 'supervisor']
};
const MIN_CREW_PER_SHIFT = 4;
const generateWeeklySchedule = async (weekStart) => {
    const employees = await (0, database_1.allQuery)('SELECT * FROM employees WHERE status=?', ['active']);
    const shifts = [];
    const employeeHours = {};
    const lastShiftType = {};
    employees.forEach(emp => {
        employeeHours[emp.id] = 0;
        lastShiftType[emp.id] = null;
    });
    const startDate = new Date(weekStart);
    for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + day);
        const dateStr = currentDate.toISOString().split('T')[0];
        for (const shiftType of ['morning', 'afternoon', 'night']) {
            const requiredSkills = SKILL_REQUIREMENTS[shiftType];
            const selectedEmployees = [];
            for (const skill of requiredSkills) {
                const eligibleEmployees = employees.filter(emp => {
                    if (emp.skills.includes(skill)) {
                        if (employeeHours[emp.id] + SHIFT_HOURS[shiftType].hours > emp.maxHoursPerWeek) {
                            return false;
                        }
                        if (lastShiftType[emp.id] === 'night' && shiftType !== 'night') {
                            return false;
                        }
                        if (selectedEmployees.includes(emp.id)) {
                            return false;
                        }
                        return true;
                    }
                    return false;
                });
                eligibleEmployees.sort((a, b) => {
                    const aHours = employeeHours[a.id];
                    const bHours = employeeHours[b.id];
                    return aHours - bHours;
                });
                if (eligibleEmployees.length > 0 && !selectedEmployees.some(id => employees.find(e => e.id === id)?.skills.includes(skill))) {
                    const selected = eligibleEmployees[0];
                    selectedEmployees.push(selected.id);
                    employeeHours[selected.id] += SHIFT_HOURS[shiftType].hours;
                    lastShiftType[selected.id] = shiftType;
                }
            }
            while (selectedEmployees.length < MIN_CREW_PER_SHIFT) {
                const eligibleEmployees = employees.filter(emp => {
                    if (selectedEmployees.includes(emp.id))
                        return false;
                    if (employeeHours[emp.id] + SHIFT_HOURS[shiftType].hours > emp.maxHoursPerWeek)
                        return false;
                    if (lastShiftType[emp.id] === 'night' && shiftType !== 'night')
                        return false;
                    return true;
                });
                eligibleEmployees.sort((a, b) => employeeHours[a.id] - employeeHours[b.id]);
                if (eligibleEmployees.length > 0) {
                    const selected = eligibleEmployees[0];
                    selectedEmployees.push(selected.id);
                    employeeHours[selected.id] += SHIFT_HOURS[shiftType].hours;
                    lastShiftType[selected.id] = shiftType;
                }
                else {
                    break;
                }
            }
            const shift = {
                id: `shift_${dateStr}_${shiftType}`,
                date: dateStr,
                shiftType,
                employeeIds: selectedEmployees,
                requiredSkills,
                startTime: SHIFT_HOURS[shiftType].start,
                endTime: SHIFT_HOURS[shiftType].end
            };
            await (0, database_1.runQuery)('INSERT INTO shifts (id, date, shiftType, employeeIds, requiredSkills, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?, ?)', [shift.id, shift.date, shift.shiftType, JSON.stringify(shift.employeeIds), JSON.stringify(shift.requiredSkills), shift.startTime, shift.endTime]);
            shifts.push(shift);
        }
    }
    return shifts;
};
exports.generateWeeklySchedule = generateWeeklySchedule;
const validateShiftSwap = async (employeeId, fromShiftId, toShiftId) => {
    const issues = [];
    const fromShift = await (0, database_1.allQuery)('SELECT * FROM shifts WHERE id=?', [fromShiftId]);
    const toShift = await (0, database_1.allQuery)('SELECT * FROM shifts WHERE id=?', [toShiftId]);
    const employee = await (0, database_1.allQuery)('SELECT * FROM employees WHERE id=?', [employeeId]);
    if (!fromShift || !toShift || !employee) {
        return { valid: false, issues: ['Shift or employee not found'] };
    }
    const fromShiftData = fromShift[0];
    const toShiftData = toShift[0];
    const employeeData = employee[0];
    if (fromShiftData.date !== toShiftData.date) {
        const daysDiff = Math.abs(new Date(fromShiftData.date).getTime() - new Date(toShiftData.date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff < 1) {
            issues.push('换班必须间隔至少24小时');
        }
    }
    if (fromShiftData.shiftType === 'night' && toShiftData.shiftType === 'morning') {
        issues.push('禁止夜班后直接换早班');
    }
    const totalHours = employeeData.currentHoursThisWeek + 8;
    if (totalHours > employeeData.maxHoursPerWeek) {
        issues.push(`换班后工时(${totalHours})将超过每周上限(${employeeData.maxHoursPerWeek})`);
    }
    const hasRequiredSkills = toShiftData.requiredSkills.every(skill => employeeData.skills.includes(skill));
    if (!hasRequiredSkills) {
        issues.push('员工不具备目标班次所需的全部技能');
    }
    return {
        valid: issues.length === 0,
        issues
    };
};
exports.validateShiftSwap = validateShiftSwap;
