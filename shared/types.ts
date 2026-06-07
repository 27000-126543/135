export interface Unit {
  id: string;
  unitNo: string;
  power: number;
  reactorType: 'PWR' | 'BWR' | 'CANDU' | 'FBR';
  currentPowerLevel: number;
  fuelRodLife: number;
  status: 'operational' | 'maintenance' | 'shutdown' | 'refueling';
  operatingHours: number;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
}

export interface GenerationPlan {
  id: string;
  unitId: string;
  date: string;
  hourlyPlan: HourlyPlan[];
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  notes?: string;
}

export interface HourlyPlan {
  hour: number;
  targetPower: number;
  rampRate: number;
}

export interface RealtimeData {
  id?: string;
  unitId: string;
  timestamp: string;
  neutronFlux: number;
  coolantTemp: number;
  coolantPressure: number;
  mainPumpSpeed: number;
  controlRodPosition: number;
}

export interface Alarm {
  id: string;
  unitId: string;
  type: 'neutron_flux' | 'coolant_temp' | 'coolant_pressure' | 'main_pump' | 'radiation';
  level: 'warning' | 'danger' | 'emergency';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  autoActionTaken?: string;
}

export interface Equipment {
  id: string;
  name: string;
  unitId: string;
  category: 'reactor' | 'turbine' | 'generator' | 'coolant' | 'electrical' | 'other';
  criticalityLevel: 1 | 2 | 3;
  operatingHours: number;
  lastMaintenance: string;
  nextMaintenance: string;
  status: 'normal' | 'warning' | 'maintenance_required' | 'failed';
}

export interface MaintenanceOrder {
  id: string;
  equipmentId: string;
  unitId: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTeam: string;
  parts: MaintenancePart[];
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface MaintenancePart {
  partId: string;
  partName: string;
  quantity: number;
  unitPrice: number;
}

export interface Inventory {
  id: string;
  partName: string;
  partNo: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  location: string;
  lastUpdated: string;
}

export interface RadiationReading {
  id: string;
  location: string;
  locationType: 'plant' | 'perimeter' | 'surrounding';
  timestamp: string;
  doseRate: number;
  unit: 'μSv/h' | 'mSv/h';
  alarmThreshold: number;
}

export interface EvacuationStatus {
  id: string;
  alarmId: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'cancelled';
  affectedZones: string[];
  personnelCount: number;
  safePersonnelCount: number;
  startTime: string;
  endTime?: string;
}

export interface Employee {
  id: string;
  name: string;
  employeeNo: string;
  skills: ('reactor_operator' | 'electrical' | 'mechanical' | 'supervisor' | 'maintenance')[];
  maxHoursPerWeek: number;
  currentHoursThisWeek: number;
  status: 'active' | 'on_leave' | 'training';
}

export interface Shift {
  id: string;
  date: string;
  shiftType: 'morning' | 'afternoon' | 'night';
  employeeIds: string[];
  requiredSkills: string[];
  startTime: string;
  endTime: string;
}

export interface ShiftSwapRequest {
  id: string;
  employeeId: string;
  fromShiftId: string;
  toShiftId: string;
  requestedToEmployeeId?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
}

export interface Statistics {
  unitId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  totalGeneration: number;
  loadFactor: number;
  unplannedOutageCount: number;
  avgRadiationDose: number;
  maxRadiationDose: number;
  equipmentAvailability: number;
}

export interface User {
  id: string;
  username: string;
  role: 'operator' | 'shift_supervisor' | 'maintenance_manager' | 'radiation_officer' | 'admin';
  name: string;
}

export interface GridLoadForecast {
  date: string;
  hourlyLoad: number[];
}

export interface ApprovalRequest {
  id: string;
  type: 'generation_plan' | 'shift_swap' | 'maintenance_order' | 'plan_adjustment';
  refId: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  comments?: string;
}
