import { runQuery, getQuery } from './database';
import { Unit, Employee, Equipment, Inventory, GridLoadForecast } from '../shared/types';

export const seedData = async () => {
  const existingUnits = await getQuery('SELECT COUNT(*) as count FROM units');
  if (existingUnits.count > 0) return;

  const units: Unit[] = [
    {
      id: 'unit_1',
      unitNo: '1号机组',
      power: 1000,
      reactorType: 'PWR',
      currentPowerLevel: 920,
      fuelRodLife: 75,
      status: 'operational',
      operatingHours: 52340,
      lastMaintenanceDate: '2025-12-15',
      nextMaintenanceDate: '2026-06-15'
    },
    {
      id: 'unit_2',
      unitNo: '2号机组',
      power: 1000,
      reactorType: 'PWR',
      currentPowerLevel: 850,
      fuelRodLife: 45,
      status: 'operational',
      operatingHours: 48210,
      lastMaintenanceDate: '2026-01-10',
      nextMaintenanceDate: '2026-07-10'
    },
    {
      id: 'unit_3',
      unitNo: '3号机组',
      power: 1200,
      reactorType: 'BWR',
      currentPowerLevel: 0,
      fuelRodLife: 90,
      status: 'maintenance',
      operatingHours: 35670,
      lastMaintenanceDate: '2025-11-20',
      nextMaintenanceDate: '2026-05-20'
    },
    {
      id: 'unit_4',
      unitNo: '4号机组',
      power: 1200,
      reactorType: 'BWR',
      currentPowerLevel: 1100,
      fuelRodLife: 60,
      status: 'operational',
      operatingHours: 31200,
      lastMaintenanceDate: '2026-02-05',
      nextMaintenanceDate: '2026-08-05'
    }
  ];

  for (const unit of units) {
    await runQuery(
      'INSERT INTO units (id, unitNo, power, reactorType, currentPowerLevel, fuelRodLife, status, operatingHours, lastMaintenanceDate, nextMaintenanceDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [unit.id, unit.unitNo, unit.power, unit.reactorType, unit.currentPowerLevel, unit.fuelRodLife, unit.status, unit.operatingHours, unit.lastMaintenanceDate, unit.nextMaintenanceDate]
    );
  }

  const employees: Employee[] = [
    { id: 'emp_1', name: '张伟', employeeNo: 'OP001', skills: ['reactor_operator', 'supervisor'], maxHoursPerWeek: 48, currentHoursThisWeek: 32, status: 'active' },
    { id: 'emp_2', name: '李明', employeeNo: 'OP002', skills: ['reactor_operator'], maxHoursPerWeek: 48, currentHoursThisWeek: 24, status: 'active' },
    { id: 'emp_3', name: '王芳', employeeNo: 'OP003', skills: ['reactor_operator'], maxHoursPerWeek: 48, currentHoursThisWeek: 40, status: 'active' },
    { id: 'emp_4', name: '刘强', employeeNo: 'EL001', skills: ['electrical', 'mechanical'], maxHoursPerWeek: 48, currentHoursThisWeek: 36, status: 'active' },
    { id: 'emp_5', name: '陈静', employeeNo: 'EL002', skills: ['electrical'], maxHoursPerWeek: 48, currentHoursThisWeek: 28, status: 'active' },
    { id: 'emp_6', name: '赵刚', employeeNo: 'ME001', skills: ['mechanical', 'maintenance'], maxHoursPerWeek: 48, currentHoursThisWeek: 44, status: 'active' },
    { id: 'emp_7', name: '孙丽', employeeNo: 'ME002', skills: ['mechanical'], maxHoursPerWeek: 48, currentHoursThisWeek: 20, status: 'active' },
    { id: 'emp_8', name: '周涛', employeeNo: 'MN001', skills: ['maintenance', 'supervisor'], maxHoursPerWeek: 48, currentHoursThisWeek: 32, status: 'active' },
    { id: 'emp_9', name: '吴明', employeeNo: 'OP004', skills: ['reactor_operator'], maxHoursPerWeek: 48, currentHoursThisWeek: 16, status: 'training' },
    { id: 'emp_10', name: '郑华', employeeNo: 'OP005', skills: ['reactor_operator', 'electrical'], maxHoursPerWeek: 48, currentHoursThisWeek: 40, status: 'active' },
    { id: 'emp_11', name: '钱伟', employeeNo: 'EL003', skills: ['electrical'], maxHoursPerWeek: 48, currentHoursThisWeek: 36, status: 'active' },
    { id: 'emp_12', name: '马超', employeeNo: 'ME003', skills: ['mechanical', 'maintenance'], maxHoursPerWeek: 48, currentHoursThisWeek: 32, status: 'active' }
  ];

  for (const emp of employees) {
    await runQuery(
      'INSERT INTO employees (id, name, employeeNo, skills, maxHoursPerWeek, currentHoursThisWeek, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [emp.id, emp.name, emp.employeeNo, JSON.stringify(emp.skills), emp.maxHoursPerWeek, emp.currentHoursThisWeek, emp.status]
    );
  }

  const equipmentData = [
    { id: 'eq_1', name: '反应堆压力容器', unitId: 'unit_1', category: 'reactor', criticalityLevel: 1, operatingHours: 52340, lastMaintenance: '2025-12-15', nextMaintenance: '2026-12-15', status: 'normal' },
    { id: 'eq_2', name: '蒸汽发生器A', unitId: 'unit_1', category: 'coolant', criticalityLevel: 1, operatingHours: 52340, lastMaintenance: '2025-12-15', nextMaintenance: '2026-12-15', status: 'normal' },
    { id: 'eq_3', name: '蒸汽发生器B', unitId: 'unit_1', category: 'coolant', criticalityLevel: 1, operatingHours: 52340, lastMaintenance: '2025-12-15', nextMaintenance: '2026-12-15', status: 'warning' },
    { id: 'eq_4', name: '主冷却剂泵1号', unitId: 'unit_1', category: 'coolant', criticalityLevel: 2, operatingHours: 48000, lastMaintenance: '2026-01-01', nextMaintenance: '2026-06-01', status: 'maintenance_required' },
    { id: 'eq_5', name: '汽轮机高压缸', unitId: 'unit_1', category: 'turbine', criticalityLevel: 2, operatingHours: 50000, lastMaintenance: '2025-11-01', nextMaintenance: '2026-05-01', status: 'normal' },
    { id: 'eq_6', name: '发电机', unitId: 'unit_1', category: 'generator', criticalityLevel: 2, operatingHours: 51000, lastMaintenance: '2025-10-01', nextMaintenance: '2026-04-01', status: 'normal' },
    { id: 'eq_7', name: '反应堆压力容器', unitId: 'unit_2', category: 'reactor', criticalityLevel: 1, operatingHours: 48210, lastMaintenance: '2026-01-10', nextMaintenance: '2027-01-10', status: 'normal' },
    { id: 'eq_8', name: '主变压器', unitId: 'unit_2', category: 'electrical', criticalityLevel: 3, operatingHours: 45000, lastMaintenance: '2026-02-01', nextMaintenance: '2026-08-01', status: 'normal' },
    { id: 'eq_9', name: '控制棒驱动机构', unitId: 'unit_1', category: 'reactor', criticalityLevel: 1, operatingHours: 52340, lastMaintenance: '2025-12-15', nextMaintenance: '2026-12-15', status: 'normal' },
    { id: 'eq_10', name: '应急柴油发电机1号', unitId: 'unit_1', category: 'electrical', criticalityLevel: 1, operatingHours: 2000, lastMaintenance: '2026-03-01', nextMaintenance: '2026-09-01', status: 'normal' }
  ];

  for (const eq of equipmentData) {
    await runQuery(
      'INSERT INTO equipment (id, name, unitId, category, criticalityLevel, operatingHours, lastMaintenance, nextMaintenance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [eq.id, eq.name, eq.unitId, eq.category, eq.criticalityLevel, eq.operatingHours, eq.lastMaintenance, eq.nextMaintenance, eq.status]
    );
  }

  const inventoryItems = [
    { id: 'inv_1', partName: '控制棒组件', partNo: 'CR-A-001', quantity: 12, minStock: 10, maxStock: 30, location: 'A区-01', lastUpdated: '2026-06-01' },
    { id: 'inv_2', partName: '主泵机械密封', partNo: 'MP-MS-002', quantity: 8, minStock: 10, maxStock: 20, location: 'B区-05', lastUpdated: '2026-06-01' },
    { id: 'inv_3', partName: '蒸汽发生器管束', partNo: 'SG-TB-003', quantity: 50, minStock: 40, maxStock: 100, location: 'C区-12', lastUpdated: '2026-06-01' },
    { id: 'inv_4', partName: '安全阀', partNo: 'RV-SV-004', quantity: 25, minStock: 20, maxStock: 50, location: 'A区-03', lastUpdated: '2026-06-01' },
    { id: 'inv_5', partName: '中子探测器', partNo: 'ND-005', quantity: 15, minStock: 15, maxStock: 30, location: 'D区-08', lastUpdated: '2026-06-01' },
    { id: 'inv_6', partName: '辐射监测仪', partNo: 'RM-006', quantity: 18, minStock: 10, maxStock: 25, location: 'D区-10', lastUpdated: '2026-06-01' },
    { id: 'inv_7', partName: '变压器绝缘油', partNo: 'TR-OIL-007', quantity: 500, minStock: 300, maxStock: 800, location: 'E区-01', lastUpdated: '2026-06-01' },
    { id: 'inv_8', partName: '轴承组件', partNo: 'BR-008', quantity: 45, minStock: 40, maxStock: 100, location: 'B区-15', lastUpdated: '2026-06-01' }
  ];

  for (const item of inventoryItems) {
    await runQuery(
      'INSERT INTO inventory (id, partName, partNo, quantity, minStock, maxStock, location, lastUpdated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [item.id, item.partName, item.partNo, item.quantity, item.minStock, item.maxStock, item.location, item.lastUpdated]
    );
  }

  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const baseLoad = 3500;
    const hourlyLoad = Array.from({ length: 24 }, (_, hour) => {
      const peakFactor = hour >= 8 && hour <= 12 ? 1.2 : hour >= 18 && hour <= 22 ? 1.15 : hour >= 0 && hour <= 6 ? 0.7 : 0.9;
      return Math.round(baseLoad * peakFactor + (Math.random() - 0.5) * 200);
    });
    
    await runQuery(
      'INSERT INTO grid_load_forecast (id, date, hourlyLoad) VALUES (?, ?, ?)',
      [`forecast_${i}`, dateStr, JSON.stringify(hourlyLoad)]
    );
  }

  const users = [
    { id: 'user_1', username: 'operator1', role: 'operator', name: '操作员-张三' },
    { id: 'user_2', username: 'supervisor1', role: 'shift_supervisor', name: '值长-李四' },
    { id: 'user_3', username: 'maint_mgr', role: 'maintenance_manager', name: '维修经理-王五' },
    { id: 'user_4', username: 'rad_officer', role: 'radiation_officer', name: '辐射防护官-赵六' },
    { id: 'user_5', username: 'admin', role: 'admin', name: '系统管理员' }
  ];

  for (const user of users) {
    await runQuery(
      'INSERT INTO users (id, username, role, name) VALUES (?, ?, ?, ?)',
      [user.id, user.username, user.role, user.name]
    );
  }

  console.log('Seed data inserted successfully');
};
