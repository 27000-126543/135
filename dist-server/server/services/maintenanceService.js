"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMaintenanceHistory = exports.updateInventory = exports.getLowStockItems = exports.generateMaintenanceOrders = void 0;
const database_1 = require("../database");
const MAINTENANCE_INTERVALS = {
    1: 8000,
    2: 4000,
    3: 2000
};
const TEAMS = ['维修一班', '维修二班', '维修三班', '电气维修班', '机械维修班'];
const generateParts = (equipment) => {
    const partsPool = [
        { partId: 'inv_1', partName: '控制棒组件', quantity: 1, unitPrice: 50000 },
        { partId: 'inv_2', partName: '主泵机械密封', quantity: 2, unitPrice: 8000 },
        { partId: 'inv_3', partName: '蒸汽发生器管束', quantity: 5, unitPrice: 3000 },
        { partId: 'inv_4', partName: '安全阀', quantity: 3, unitPrice: 2000 },
        { partId: 'inv_8', partName: '轴承组件', quantity: 2, unitPrice: 1500 }
    ];
    const selectedParts = [];
    const numParts = Math.min(equipment.criticalityLevel + 1, partsPool.length);
    for (let i = 0; i < numParts; i++) {
        const part = { ...partsPool[i % partsPool.length] };
        part.quantity = Math.ceil(Math.random() * equipment.criticalityLevel);
        selectedParts.push(part);
    }
    return selectedParts;
};
const generateMaintenanceOrders = async () => {
    const equipmentList = await (0, database_1.allQuery)('SELECT * FROM equipment');
    const orders = [];
    const today = new Date();
    for (const equipment of equipmentList) {
        const interval = MAINTENANCE_INTERVALS[equipment.criticalityLevel];
        const hoursSinceMaintenance = equipment.operatingHours - (equipment.lastMaintenance ? 0 : equipment.operatingHours);
        const needsMaintenance = hoursSinceMaintenance >= interval * 0.9 ||
            equipment.status === 'maintenance_required' ||
            equipment.status === 'warning';
        if (needsMaintenance) {
            const existingOrder = await (0, database_1.getQuery)('SELECT * FROM maintenance_orders WHERE equipmentId=? AND status IN (?, ?)', [equipment.id, 'pending', 'in_progress']);
            if (!existingOrder) {
                const priority = equipment.criticalityLevel === 1 ? 'critical' :
                    equipment.criticalityLevel === 2 ? 'high' : 'medium';
                const teamIndex = Math.floor(Math.random() * TEAMS.length);
                const parts = generateParts(equipment);
                const order = {
                    id: `mo_${Date.now()}_${equipment.id}`,
                    equipmentId: equipment.id,
                    unitId: equipment.unitId,
                    description: `定期维护 - ${equipment.name}`,
                    priority,
                    assignedTeam: TEAMS[teamIndex],
                    parts,
                    status: 'pending',
                    createdAt: today.toISOString()
                };
                await (0, database_1.runQuery)('INSERT INTO maintenance_orders (id, equipmentId, unitId, description, priority, assignedTeam, parts, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [order.id, order.equipmentId, order.unitId, order.description, order.priority, order.assignedTeam, JSON.stringify(order.parts), order.status, order.createdAt]);
                for (const part of parts) {
                    await (0, database_1.runQuery)('UPDATE inventory SET quantity=quantity-?, lastUpdated=? WHERE id=?', [part.quantity, today.toISOString(), part.partId]);
                }
                orders.push(order);
            }
        }
    }
    return orders;
};
exports.generateMaintenanceOrders = generateMaintenanceOrders;
const getLowStockItems = async () => {
    const items = await (0, database_1.allQuery)('SELECT * FROM inventory WHERE quantity <= minStock');
    return items;
};
exports.getLowStockItems = getLowStockItems;
const updateInventory = async (partId, quantityChange) => {
    const today = new Date().toISOString();
    await (0, database_1.runQuery)('UPDATE inventory SET quantity=quantity+?, lastUpdated=? WHERE id=?', [quantityChange, today, partId]);
};
exports.updateInventory = updateInventory;
const getMaintenanceHistory = async (equipmentId) => {
    const rows = await (0, database_1.allQuery)('SELECT * FROM maintenance_orders WHERE equipmentId=? ORDER BY createdAt DESC', [equipmentId]);
    return rows.map(row => ({
        ...row,
        parts: JSON.parse(row.parts || '[]')
    }));
};
exports.getMaintenanceHistory = getMaintenanceHistory;
