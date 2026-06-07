import { create } from 'zustand';
import { Unit, GenerationPlan, RealtimeData, Alarm, Equipment, MaintenanceOrder, Inventory, RadiationReading, EvacuationStatus, Employee, Shift, ShiftSwapRequest, Statistics, ApprovalRequest, User } from '../../shared/types';

interface AppState {
  user: User | null;
  units: Unit[];
  generationPlans: GenerationPlan[];
  realtimeData: Record<string, RealtimeData>;
  alarms: Alarm[];
  equipment: Equipment[];
  maintenanceOrders: MaintenanceOrder[];
  inventory: Inventory[];
  radiationReadings: RadiationReading[];
  evacuationStatus: EvacuationStatus[];
  employees: Employee[];
  shifts: Shift[];
  shiftSwapRequests: ShiftSwapRequest[];
  statistics: Statistics[];
  approvalRequests: ApprovalRequest[];
  lowStockItems: Inventory[];
  setUser: (user: User | null) => void;
  setUnits: (units: Unit[]) => void;
  setGenerationPlans: (plans: GenerationPlan[]) => void;
  addGenerationPlan: (plan: GenerationPlan) => void;
  updateGenerationPlan: (plan: GenerationPlan) => void;
  setRealtimeData: (unitId: string, data: RealtimeData) => void;
  setAlarms: (alarms: Alarm[]) => void;
  addAlarm: (alarm: Alarm) => void;
  acknowledgeAlarm: (alarmId: string) => void;
  setEquipment: (equipment: Equipment[]) => void;
  setMaintenanceOrders: (orders: MaintenanceOrder[]) => void;
  addMaintenanceOrder: (order: MaintenanceOrder) => void;
  updateMaintenanceOrder: (order: MaintenanceOrder) => void;
  setInventory: (inventory: Inventory[]) => void;
  setLowStockItems: (items: Inventory[]) => void;
  updateInventory: (item: Inventory) => void;
  setRadiationReadings: (readings: RadiationReading[]) => void;
  addRadiationReading: (reading: RadiationReading) => void;
  setEvacuationStatus: (status: EvacuationStatus[]) => void;
  addEvacuationStatus: (status: EvacuationStatus) => void;
  updateEvacuationStatus: (status: EvacuationStatus) => void;
  setEmployees: (employees: Employee[]) => void;
  setShifts: (shifts: Shift[]) => void;
  setShiftSwapRequests: (requests: ShiftSwapRequest[]) => void;
  addShiftSwapRequest: (request: ShiftSwapRequest) => void;
  updateShiftSwapRequest: (request: ShiftSwapRequest) => void;
  setStatistics: (statistics: Statistics[]) => void;
  setApprovalRequests: (requests: ApprovalRequest[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: { id: 'user_1', username: 'operator1', role: 'operator', name: '操作员-张三' },
  units: [],
  generationPlans: [],
  realtimeData: {},
  alarms: [],
  equipment: [],
  maintenanceOrders: [],
  inventory: [],
  radiationReadings: [],
  evacuationStatus: [],
  employees: [],
  shifts: [],
  shiftSwapRequests: [],
  statistics: [],
  approvalRequests: [],
  lowStockItems: [],

  setUser: (user) => set({ user }),
  setUnits: (units) => set({ units }),
  setGenerationPlans: (plans) => set({ generationPlans: plans }),
  addGenerationPlan: (plan) => set((state) => ({ generationPlans: [plan, ...state.generationPlans] })),
  updateGenerationPlan: (plan) => set((state) => ({
    generationPlans: state.generationPlans.map(p => p.id === plan.id ? plan : p)
  })),
  setRealtimeData: (unitId, data) => set((state) => ({
    realtimeData: { ...state.realtimeData, [unitId]: data }
  })),
  setAlarms: (alarms) => set({ alarms }),
  addAlarm: (alarm) => set((state) => ({ alarms: [alarm, ...state.alarms] })),
  acknowledgeAlarm: (alarmId) => set((state) => ({
    alarms: state.alarms.map(a => a.id === alarmId ? { ...a, acknowledged: true } : a)
  })),
  setEquipment: (equipment) => set({ equipment }),
  setMaintenanceOrders: (orders) => set({ maintenanceOrders: orders }),
  addMaintenanceOrder: (order) => set((state) => ({ maintenanceOrders: [order, ...state.maintenanceOrders] })),
  updateMaintenanceOrder: (order) => set((state) => ({
    maintenanceOrders: state.maintenanceOrders.map(o => o.id === order.id ? order : o)
  })),
  setInventory: (inventory) => set({ inventory }),
  setLowStockItems: (items) => set({ lowStockItems: items }),
  updateInventory: (item) => set((state) => ({
    inventory: state.inventory.map(i => i.id === item.id ? item : i)
  })),
  setRadiationReadings: (readings) => set({ radiationReadings: readings }),
  addRadiationReading: (reading) => set((state) => ({
    radiationReadings: [reading, ...state.radiationReadings].slice(0, 200)
  })),
  setEvacuationStatus: (status) => set({ evacuationStatus: status }),
  addEvacuationStatus: (status) => set((state) => ({ evacuationStatus: [status, ...state.evacuationStatus] })),
  updateEvacuationStatus: (status) => set((state) => ({
    evacuationStatus: state.evacuationStatus.map(s => s.id === status.id ? status : s)
  })),
  setEmployees: (employees) => set({ employees }),
  setShifts: (shifts) => set({ shifts }),
  setShiftSwapRequests: (requests) => set({ shiftSwapRequests: requests }),
  addShiftSwapRequest: (request) => set((state) => ({ shiftSwapRequests: [request, ...state.shiftSwapRequests] })),
  updateShiftSwapRequest: (request) => set((state) => ({
    shiftSwapRequests: state.shiftSwapRequests.map(r => r.id === request.id ? request : r)
  })),
  setStatistics: (statistics) => set({ statistics }),
  setApprovalRequests: (requests) => set({ approvalRequests: requests }),
}));
