"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportToPDF = exports.calculateStatistics = void 0;
const database_1 = require("../database");
const jspdf_1 = __importDefault(require("jspdf"));
const jspdf_autotable_1 = __importDefault(require("jspdf-autotable"));
const calculateStatistics = async (unitId, period, startDate, endDate) => {
    const units = unitId === 'all'
        ? await (0, database_1.allQuery)('SELECT * FROM units')
        : [await (0, database_1.getQuery)('SELECT * FROM units WHERE id=?', [unitId])];
    const statistics = [];
    for (const unit of units) {
        if (!unit)
            continue;
        const realtimeData = await (0, database_1.allQuery)('SELECT * FROM realtime_data WHERE unitId=? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp', [unit.id, startDate, endDate]);
        const radiationData = await (0, database_1.allQuery)('SELECT * FROM radiation_readings WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp', [startDate, endDate]);
        const equipmentList = await (0, database_1.allQuery)('SELECT * FROM equipment WHERE unitId=?', [unit.id]);
        const plans = await (0, database_1.allQuery)('SELECT * FROM generation_plans WHERE unitId=? AND date >= ? AND date <= ?', [unit.id, startDate, endDate]);
        const totalGeneration = realtimeData.reduce((sum, data) => {
            const powerMw = data.neutronFlux / 1e10;
            return sum + powerMw * (2 / 3600);
        }, 0);
        const maxPower = unit.power;
        const hoursInPeriod = period === 'daily' ? 24 : period === 'weekly' ? 168 : 720;
        const theoreticalMax = maxPower * hoursInPeriod;
        const loadFactor = theoreticalMax > 0 ? (totalGeneration / theoreticalMax) * 100 : 0;
        let unplannedOutageCount = 0;
        let wasOperational = true;
        for (const data of realtimeData) {
            const isOperational = data.neutronFlux > 1e12;
            if (!isOperational && wasOperational) {
                unplannedOutageCount++;
            }
            wasOperational = isOperational;
        }
        const radiationDoses = radiationData.map(r => r.doseRate);
        const avgRadiationDose = radiationDoses.length > 0
            ? radiationDoses.reduce((a, b) => a + b, 0) / radiationDoses.length
            : 0;
        const maxRadiationDose = radiationDoses.length > 0
            ? Math.max(...radiationDoses)
            : 0;
        const availableEquipment = equipmentList.filter(e => e.status === 'normal' || e.status === 'warning');
        const equipmentAvailability = equipmentList.length > 0
            ? (availableEquipment.length / equipmentList.length) * 100
            : 100;
        statistics.push({
            unitId: unit.id,
            period,
            startDate,
            endDate,
            totalGeneration: Math.round(totalGeneration * 100) / 100,
            loadFactor: Math.round(loadFactor * 100) / 100,
            unplannedOutageCount,
            avgRadiationDose: Math.round(avgRadiationDose * 10000) / 10000,
            maxRadiationDose: Math.round(maxRadiationDose * 10000) / 10000,
            equipmentAvailability: Math.round(equipmentAvailability * 100) / 100
        });
    }
    return statistics;
};
exports.calculateStatistics = calculateStatistics;
const exportToPDF = async (unitId, period, startDate, endDate) => {
    const statistics = await (0, exports.calculateStatistics)(unitId, period, startDate, endDate);
    const units = await (0, database_1.allQuery)('SELECT * FROM units');
    const doc = new jspdf_1.default();
    doc.setFontSize(20);
    doc.text('核电站运行月度报告', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`报告周期: ${startDate} 至 ${endDate}`, 14, 35);
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 14, 45);
    let yPos = 60;
    for (const stat of statistics) {
        const unit = units.find((u) => u.id === stat.unitId);
        const unitName = unit ? unit.unitNo : '汇总';
        doc.setFontSize(14);
        doc.text(`${unitName} - 运行统计`, 14, yPos);
        yPos += 10;
        const tableData = [
            ['指标', '数值', '单位'],
            ['总发电量', stat.totalGeneration.toFixed(2), 'MWh'],
            ['负荷因子', stat.loadFactor.toFixed(2), '%'],
            ['非计划停运次数', stat.unplannedOutageCount.toString(), '次'],
            ['平均辐射剂量', stat.avgRadiationDose.toFixed(4), 'μSv/h'],
            ['最大辐射剂量', stat.maxRadiationDose.toFixed(4), 'μSv/h'],
            ['设备可用率', stat.equipmentAvailability.toFixed(2), '%']
        ];
        (0, jspdf_autotable_1.default)(doc, {
            head: [tableData[0]],
            body: tableData.slice(1),
            startY: yPos,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [66, 139, 202] }
        });
        yPos = doc.lastAutoTable.finalY + 15;
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
    }
    doc.setFontSize(14);
    doc.text('机组状态概览', 14, yPos);
    yPos += 10;
    const unitTableData = [
        ['机组编号', '额定功率', '当前功率', '燃料寿期', '状态'],
        ...units.map((u) => [
            u.unitNo,
            `${u.power} MW`,
            `${u.currentPowerLevel} MW`,
            `${u.fuelRodLife}%`,
            getStatusText(u.status)
        ])
    ];
    (0, jspdf_autotable_1.default)(doc, {
        head: [unitTableData[0]],
        body: unitTableData.slice(1),
        startY: yPos,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [92, 184, 92] }
    });
    yPos = doc.lastAutoTable.finalY + 15;
    if (yPos > 250) {
        doc.addPage();
        yPos = 20;
    }
    doc.setFontSize(14);
    doc.text('设备状态统计', 14, yPos);
    yPos += 10;
    const equipment = await (0, database_1.allQuery)('SELECT * FROM equipment');
    const statusCounts = {
        normal: 0,
        warning: 0,
        maintenance_required: 0,
        failed: 0
    };
    equipment.forEach((e) => {
        statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    });
    const equipTableData = [
        ['状态', '数量', '占比'],
        ['正常', statusCounts.normal.toString(), ((statusCounts.normal / equipment.length) * 100).toFixed(1) + '%'],
        ['预警', statusCounts.warning.toString(), ((statusCounts.warning / equipment.length) * 100).toFixed(1) + '%'],
        ['需维护', statusCounts.maintenance_required.toString(), ((statusCounts.maintenance_required / equipment.length) * 100).toFixed(1) + '%'],
        ['故障', statusCounts.failed.toString(), ((statusCounts.failed / equipment.length) * 100).toFixed(1) + '%']
    ];
    (0, jspdf_autotable_1.default)(doc, {
        head: [equipTableData[0]],
        body: equipTableData.slice(1),
        startY: yPos,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [240, 173, 78] }
    });
    doc.setFontSize(10);
    doc.text('报告生成系统: 核电站运行调度与安全监控系统', 14, 280);
    doc.text('本报告为机密文件，仅限授权人员查阅', 14, 287);
    return Buffer.from(doc.output('arraybuffer'));
};
exports.exportToPDF = exportToPDF;
const getStatusText = (status) => {
    const statusMap = {
        operational: '运行中',
        maintenance: '维护中',
        shutdown: '停机',
        refueling: '换料中'
    };
    return statusMap[status] || status;
};
