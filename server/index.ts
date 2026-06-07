import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { initDatabase, allQuery, runQuery, getQuery } from './database';
import { seedData } from './seed';
import { Unit, GenerationPlan, HourlyPlan, RealtimeData, Alarm, Equipment, MaintenanceOrder, Inventory, RadiationReading, EvacuationStatus, Employee, Shift, ShiftSwapRequest, Statistics, GridLoadForecast, ApprovalRequest } from '../shared/types';
import { generateGenerationPlan } from './services/generationPlanService';
import { checkAlarms, executeProtectionAction } from './services/alarmService';
import { generateMaintenanceOrders } from './services/maintenanceService';
import { checkRadiationLevels, initiateEvacuation } from './services/radiationService';
import { generateWeeklySchedule } from './services/schedulingService';
import { calculateStatistics, exportToPDF } from './services/statisticsService';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

initDatabase();
seedData();

const PORT = 3001;

app.get('/api/units', async (req, res) => {
  const rows = await allQuery('SELECT * FROM units');
  res.json(rows);
});

app.post('/api/units', async (req, res) => {
  const unit: Unit = req.body;
  await runQuery(
    'INSERT INTO units (id, unitNo, power, reactorType, currentPowerLevel, fuelRodLife, status, operatingHours, lastMaintenanceDate, nextMaintenanceDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [unit.id, unit.unitNo, unit.power, unit.reactorType, unit.currentPowerLevel, unit.fuelRodLife, unit.status, unit.operatingHours, unit.lastMaintenanceDate, unit.nextMaintenanceDate]
  );
  res.json(unit);
});

app.put('/api/units/:id', async (req, res) => {
  const unit: Unit = req.body;
  await runQuery(
    'UPDATE units SET unitNo=?, power=?, reactorType=?, currentPowerLevel=?, fuelRodLife=?, status=?, operatingHours=?, lastMaintenanceDate=?, nextMaintenanceDate=? WHERE id=?',
    [unit.unitNo, unit.power, unit.reactorType, unit.currentPowerLevel, unit.fuelRodLife, unit.status, unit.operatingHours, unit.lastMaintenanceDate, unit.nextMaintenanceDate, req.params.id]
  );
  res.json(unit);
});

app.delete('/api/units/:id', async (req, res) => {
  await runQuery('DELETE FROM units WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/generation-plans', async (req, res) => {
  const rows = await allQuery('SELECT * FROM generation_plans ORDER BY createdAt DESC');
  const plans = rows.map(row => ({
    ...row,
    hourlyPlan: JSON.parse(row.hourlyPlan)
  }));
  res.json(plans);
});

app.post('/api/generation-plans/generate', async (req, res) => {
  const { unitId, date, gridForecast } = req.body;
  const plan = await generateGenerationPlan(unitId, date, gridForecast);
  res.json(plan);
});

app.post('/api/generation-plans', async (req, res) => {
  const plan: GenerationPlan = req.body;
  await runQuery(
    'INSERT INTO generation_plans (id, unitId, date, hourlyPlan, status, createdAt, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [plan.id, plan.unitId, plan.date, JSON.stringify(plan.hourlyPlan), plan.status, plan.createdAt, plan.notes || '']
  );
  io.emit('planCreated', plan);
  res.json(plan);
});

app.put('/api/generation-plans/:id/approve', async (req, res) => {
  const { approvedBy, status, comments } = req.body;
  const plan = await getQuery('SELECT * FROM generation_plans WHERE id=?', [req.params.id]);
  if (status === 'approved') {
    await runQuery(
      'UPDATE generation_plans SET status=?, approvedBy=?, approvedAt=? WHERE id=?',
      ['approved', approvedBy, new Date().toISOString(), req.params.id]
    );
    const approvalRequest = await getQuery('SELECT * FROM approval_requests WHERE refId=? AND type=?', [req.params.id, 'generation_plan']);
    if (approvalRequest) {
      await runQuery(
        'UPDATE approval_requests SET status=?, approvedBy=?, approvedAt=?, comments=? WHERE id=?',
        ['approved', approvedBy, new Date().toISOString(), comments || '', approvalRequest.id]
      );
    }
    io.emit('planApproved', { planId: req.params.id, approvedBy });
  } else {
    await runQuery(
      'UPDATE generation_plans SET status=? WHERE id=?',
      ['rejected', req.params.id]
    );
    const approvalRequest = await getQuery('SELECT * FROM approval_requests WHERE refId=? AND type=?', [req.params.id, 'generation_plan']);
    if (approvalRequest) {
      await runQuery(
        'UPDATE approval_requests SET status=?, approvedBy=?, approvedAt=?, comments=? WHERE id=?',
        ['rejected', approvedBy, new Date().toISOString(), comments || '', approvalRequest.id]
      );
    }
    io.emit('planRejected', { planId: req.params.id, comments });
  }
  res.json({ success: true });
});

app.post('/api/generation-plans/:id/request-adjustment', async (req, res) => {
  const { requestedBy, newPlan, reason } = req.body;
  const approvalId = `adj_${Date.now()}`;
  await runQuery(
    'INSERT INTO approval_requests (id, type, refId, requestedBy, requestedAt, status, comments) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [approvalId, 'plan_adjustment', req.params.id, requestedBy, new Date().toISOString(), 'pending', reason]
  );
  io.emit('adjustmentRequested', { planId: req.params.id, newPlan, reason, approvalId });
  res.json({ approvalId, success: true });
});

app.get('/api/realtime-data/:unitId', async (req, res) => {
  const rows = await allQuery('SELECT * FROM realtime_data WHERE unitId=? ORDER BY timestamp DESC LIMIT 100', [req.params.unitId]);
  res.json(rows);
});

app.get('/api/alarms', async (req, res) => {
  const rows = await allQuery('SELECT * FROM alarms ORDER BY timestamp DESC LIMIT 50');
  res.json(rows);
});

app.put('/api/alarms/:id/acknowledge', async (req, res) => {
  await runQuery('UPDATE alarms SET acknowledged=1 WHERE id=?', [req.params.id]);
  io.emit('alarmAcknowledged', req.params.id);
  res.json({ success: true });
});

app.get('/api/equipment', async (req, res) => {
  const rows = await allQuery('SELECT * FROM equipment');
  res.json(rows);
});

app.get('/api/maintenance-orders', async (req, res) => {
  const rows = await allQuery('SELECT * FROM maintenance_orders ORDER BY createdAt DESC');
  const orders = rows.map(row => ({
    ...row,
    parts: JSON.parse(row.parts || '[]')
  }));
  res.json(orders);
});

app.post('/api/maintenance-orders/generate', async (req, res) => {
  const orders = await generateMaintenanceOrders();
  res.json(orders);
});

app.put('/api/maintenance-orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const updates: any[] = [status];
  let sql = 'UPDATE maintenance_orders SET status=?';
  if (status === 'in_progress') {
    sql += ', startedAt=?';
    updates.push(new Date().toISOString());
  } else if (status === 'completed') {
    sql += ', completedAt=?';
    updates.push(new Date().toISOString());
  }
  sql += ' WHERE id=?';
  updates.push(req.params.id);
  await runQuery(sql, updates);
  res.json({ success: true });
});

app.get('/api/inventory', async (req, res) => {
  const rows = await allQuery('SELECT * FROM inventory');
  res.json(rows);
});

app.get('/api/inventory/low-stock', async (req, res) => {
  const rows = await allQuery('SELECT * FROM inventory WHERE quantity <= minStock');
  res.json(rows);
});

app.get('/api/radiation-readings', async (req, res) => {
  const rows = await allQuery('SELECT * FROM radiation_readings ORDER BY timestamp DESC LIMIT 100');
  res.json(rows);
});

app.get('/api/evacuation-status', async (req, res) => {
  const rows = await allQuery('SELECT * FROM evacuation_status ORDER BY startTime DESC LIMIT 10');
  const statuses = rows.map(row => ({
    ...row,
    affectedZones: JSON.parse(row.affectedZones || '[]')
  }));
  res.json(statuses);
});

app.post('/api/evacuation-status', async (req, res) => {
  const evacuation: EvacuationStatus = req.body;
  await runQuery(
    'INSERT INTO evacuation_status (id, alarmId, status, affectedZones, personnelCount, safePersonnelCount, startTime) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [evacuation.id, evacuation.alarmId, evacuation.status, JSON.stringify(evacuation.affectedZones), evacuation.personnelCount, evacuation.safePersonnelCount, evacuation.startTime]
  );
  io.emit('evacuationInitiated', evacuation);
  res.json(evacuation);
});

app.put('/api/evacuation-status/:id', async (req, res) => {
  const { safePersonnelCount, status, endTime } = req.body;
  await runQuery(
    'UPDATE evacuation_status SET safePersonnelCount=?, status=?, endTime=? WHERE id=?',
    [safePersonnelCount, status, endTime || null, req.params.id]
  );
  io.emit('evacuationUpdated', { id: req.params.id, safePersonnelCount, status });
  res.json({ success: true });
});

app.get('/api/employees', async (req, res) => {
  const rows = await allQuery('SELECT * FROM employees');
  const employees = rows.map(row => ({
    ...row,
    skills: JSON.parse(row.skills || '[]')
  }));
  res.json(employees);
});

app.get('/api/shifts', async (req, res) => {
  const rows = await allQuery('SELECT * FROM shifts ORDER BY date, shiftType');
  const shifts = rows.map(row => ({
    ...row,
    employeeIds: JSON.parse(row.employeeIds || '[]'),
    requiredSkills: JSON.parse(row.requiredSkills || '[]')
  }));
  res.json(shifts);
});

app.post('/api/shifts/generate', async (req, res) => {
  const { weekStart } = req.body;
  const shifts = await generateWeeklySchedule(weekStart);
  res.json(shifts);
});

app.get('/api/shift-swap-requests', async (req, res) => {
  const rows = await allQuery('SELECT * FROM shift_swap_requests ORDER BY status');
  res.json(rows);
});

app.post('/api/shift-swap-requests', async (req, res) => {
  const request: ShiftSwapRequest = req.body;
  await runQuery(
    'INSERT INTO shift_swap_requests (id, employeeId, fromShiftId, toShiftId, requestedToEmployeeId, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [request.id, request.employeeId, request.fromShiftId, request.toShiftId, request.requestedToEmployeeId || null, request.reason, request.status]
  );
  const approvalId = `swap_${Date.now()}`;
  await runQuery(
    'INSERT INTO approval_requests (id, type, refId, requestedBy, requestedAt, status) VALUES (?, ?, ?, ?, ?, ?)',
    [approvalId, 'shift_swap', request.id, request.employeeId, new Date().toISOString(), 'pending']
  );
  io.emit('swapRequestCreated', request);
  res.json(request);
});

app.put('/api/shift-swap-requests/:id/approve', async (req, res) => {
  const { approvedBy, status } = req.body;
  await runQuery(
    'UPDATE shift_swap_requests SET status=?, approvedBy=? WHERE id=?',
    [status, approvedBy, req.params.id]
  );
  const approvalRequest = await getQuery('SELECT * FROM approval_requests WHERE refId=? AND type=?', [req.params.id, 'shift_swap']);
  if (approvalRequest) {
    await runQuery(
      'UPDATE approval_requests SET status=?, approvedBy=?, approvedAt=? WHERE id=?',
      [status, approvedBy, new Date().toISOString(), approvalRequest.id]
    );
  }
  if (status === 'approved') {
    const swapRequest = await getQuery('SELECT * FROM shift_swap_requests WHERE id=?', [req.params.id]);
    if (swapRequest) {
      const fromShift = await getQuery('SELECT * FROM shifts WHERE id=?', [swapRequest.fromShiftId]);
      const toShift = await getQuery('SELECT * FROM shifts WHERE id=?', [swapRequest.toShiftId]);
      if (fromShift && toShift) {
        const fromEmployees = JSON.parse(fromShift.employeeIds || '[]');
        const toEmployees = JSON.parse(toShift.employeeIds || '[]');
        const newFromEmployees = fromEmployees.filter((id: string) => id !== swapRequest.employeeId);
        if (swapRequest.requestedToEmployeeId) {
          newFromEmployees.push(swapRequest.requestedToEmployeeId);
          const newToEmployees = toEmployees.filter((id: string) => id !== swapRequest.requestedToEmployeeId);
          newToEmployees.push(swapRequest.employeeId);
          await runQuery('UPDATE shifts SET employeeIds=? WHERE id=?', [JSON.stringify(newToEmployees), swapRequest.toShiftId]);
        } else {
          const newToEmployees = [...toEmployees, swapRequest.employeeId];
          await runQuery('UPDATE shifts SET employeeIds=? WHERE id=?', [JSON.stringify(newToEmployees), swapRequest.toShiftId]);
        }
        await runQuery('UPDATE shifts SET employeeIds=? WHERE id=?', [JSON.stringify(newFromEmployees), swapRequest.fromShiftId]);
      }
    }
  }
  io.emit('swapRequestUpdated', { id: req.params.id, status });
  res.json({ success: true });
});

app.get('/api/statistics', async (req, res) => {
  const { unitId, period, startDate, endDate } = req.query;
  const stats = await calculateStatistics(unitId as string, period as any, startDate as string, endDate as string);
  res.json(stats);
});

app.get('/api/statistics/export-pdf', async (req, res) => {
  const { unitId, period, startDate, endDate } = req.query;
  const pdfBuffer = await exportToPDF(unitId as string, period as any, startDate as string, endDate as string);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=monthly-report.pdf');
  res.send(pdfBuffer);
});

app.get('/api/approval-requests', async (req, res) => {
  const rows = await allQuery('SELECT * FROM approval_requests ORDER BY requestedAt DESC');
  res.json(rows);
});

app.get('/api/grid-load-forecast', async (req, res) => {
  const { date } = req.query;
  let rows;
  if (date) {
    rows = await allQuery('SELECT * FROM grid_load_forecast WHERE date=?', [date as string]);
  } else {
    rows = await allQuery('SELECT * FROM grid_load_forecast ORDER BY date DESC LIMIT 7');
  }
  const forecasts = rows.map(row => ({
    ...row,
    hourlyLoad: JSON.parse(row.hourlyLoad || '[]')
  }));
  res.json(forecasts);
});

let simulationInterval: NodeJS.Timeout | null = null;

const startSimulation = () => {
  if (simulationInterval) return;
  
  simulationInterval = setInterval(async () => {
    const units = await allQuery('SELECT * FROM units WHERE status=?', ['operational']);
    
    for (const unit of units) {
      const data: RealtimeData = {
        id: `rt_${Date.now()}_${unit.id}`,
        unitId: unit.id,
        timestamp: new Date().toISOString(),
        neutronFlux: 1e13 + Math.random() * 1e12 - 5e11,
        coolantTemp: 300 + Math.random() * 20 - 10,
        coolantPressure: 155 + Math.random() * 10 - 5,
        mainPumpSpeed: 1500 + Math.random() * 100 - 50,
        controlRodPosition: 50 + Math.random() * 10 - 5
      };
      
      await runQuery(
        'INSERT INTO realtime_data (id, unitId, timestamp, neutronFlux, coolantTemp, coolantPressure, mainPumpSpeed, controlRodPosition) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [data.id, data.unitId, data.timestamp, data.neutronFlux, data.coolantTemp, data.coolantPressure, data.mainPumpSpeed, data.controlRodPosition]
      );
      
      const alarm = await checkAlarms(data);
      if (alarm) {
        io.emit('alarm', alarm);
        if (alarm.level === 'emergency') {
          const action = await executeProtectionAction(unit.id, alarm);
          io.emit('protectionAction', action);
        }
      }
      
      io.emit('realtimeData', data);
    }
    
    const locations = ['反应堆厂房', '汽轮机厂房', '厂区边界1', '厂区边界2', '周边居民区1', '周边居民区2'];
    const locationTypes: Array<'plant' | 'perimeter' | 'surrounding'> = ['plant', 'plant', 'perimeter', 'perimeter', 'surrounding', 'surrounding'];
    
    for (let i = 0; i < locations.length; i++) {
      const baseLevel = locationTypes[i] === 'plant' ? 5 : locationTypes[i] === 'perimeter' ? 1 : 0.1;
      const reading: RadiationReading = {
        id: `rad_${Date.now()}_${i}`,
        location: locations[i],
        locationType: locationTypes[i],
        timestamp: new Date().toISOString(),
        doseRate: baseLevel + Math.random() * baseLevel * 0.5,
        unit: 'μSv/h',
        alarmThreshold: locationTypes[i] === 'plant' ? 100 : locationTypes[i] === 'perimeter' ? 10 : 1
      };
      
      await runQuery(
        'INSERT INTO radiation_readings (id, location, locationType, timestamp, doseRate, unit, alarmThreshold) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [reading.id, reading.location, reading.locationType, reading.timestamp, reading.doseRate, reading.unit, reading.alarmThreshold]
      );
      
      const radAlarm = await checkRadiationLevels(reading);
      if (radAlarm) {
        io.emit('radiationAlarm', radAlarm);
        if (radAlarm.level === 'emergency') {
          const evacuation = await initiateEvacuation(radAlarm);
          io.emit('evacuationInitiated', evacuation);
        }
      }
      
      io.emit('radiationReading', reading);
    }
  }, 2000);
};

startSimulation();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
