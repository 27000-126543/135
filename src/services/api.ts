import axios from 'axios';
import { Unit, GenerationPlan, RealtimeData, Alarm, Equipment, MaintenanceOrder, Inventory, RadiationReading, EvacuationStatus, Employee, Shift, ShiftSwapRequest, Statistics, ApprovalRequest } from '../../shared/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const unitApi = {
  getAll: () => api.get<Unit[]>('/units'),
  create: (unit: Unit) => api.post<Unit>('/units', unit),
  update: (id: string, unit: Unit) => api.put<Unit>(`/units/${id}`, unit),
  delete: (id: string) => api.delete(`/units/${id}`)
};

export const generationPlanApi = {
  getAll: () => api.get<GenerationPlan[]>('/generation-plans'),
  generate: (unitId: string, date: string, gridForecast?: number[]) => 
    api.post<GenerationPlan>('/generation-plans/generate', { unitId, date, gridForecast }),
  create: (plan: GenerationPlan) => api.post<GenerationPlan>('/generation-plans', plan),
  approve: (id: string, approvedBy: string, status: 'approved' | 'rejected', comments?: string) =>
    api.put(`/generation-plans/${id}/approve`, { approvedBy, status, comments }),
  requestAdjustment: (id: string, requestedBy: string, newPlan: any, reason: string) =>
    api.post(`/generation-plans/${id}/request-adjustment`, { requestedBy, newPlan, reason })
};

export const realtimeDataApi = {
  getByUnit: (unitId: string) => api.get<RealtimeData[]>(`/realtime-data/${unitId}`)
};

export const alarmApi = {
  getAll: () => api.get<Alarm[]>('/alarms'),
  acknowledge: (id: string) => api.put(`/alarms/${id}/acknowledge`)
};

export const equipmentApi = {
  getAll: () => api.get<Equipment[]>('/equipment')
};

export const maintenanceOrderApi = {
  getAll: () => api.get<MaintenanceOrder[]>('/maintenance-orders'),
  generate: () => api.post<MaintenanceOrder[]>('/maintenance-orders/generate'),
  updateStatus: (id: string, status: MaintenanceOrder['status']) =>
    api.put(`/maintenance-orders/${id}/status`, { status })
};

export const inventoryApi = {
  getAll: () => api.get<Inventory[]>('/inventory'),
  getLowStock: () => api.get<Inventory[]>('/inventory/low-stock'),
  restock: (id: string, quantity: number) =>
    api.put<Inventory>(`/inventory/${id}/restock`, { quantity })
};

export const radiationApi = {
  getAll: () => api.get<RadiationReading[]>('/radiation-readings'),
  getEvacuationStatus: () => api.get<EvacuationStatus[]>('/evacuation-status'),
  createEvacuation: (evacuation: EvacuationStatus) =>
    api.post<EvacuationStatus>('/evacuation-status', evacuation),
  updateEvacuation: (id: string, safePersonnelCount: number, status: EvacuationStatus['status'], endTime?: string) =>
    api.put(`/evacuation-status/${id}`, { safePersonnelCount, status, endTime })
};

export const employeeApi = {
  getAll: () => api.get<Employee[]>('/employees').then(res => ({
    ...res,
    data: res.data.map(emp => ({
      ...emp,
      skills: Array.isArray(emp.skills) ? emp.skills : JSON.parse(emp.skills || '[]')
    }))
  }))
};

export const shiftApi = {
  getAll: () => api.get<Shift[]>('/shifts'),
  generate: (weekStart: string) => api.post<Shift[]>('/shifts/generate', { weekStart })
};

export const shiftSwapRequestApi = {
  getAll: () => api.get<ShiftSwapRequest[]>('/shift-swap-requests'),
  create: (request: ShiftSwapRequest) => api.post<ShiftSwapRequest>('/shift-swap-requests', request),
  approve: (id: string, approvedBy: string, status: 'approved' | 'rejected') =>
    api.put(`/shift-swap-requests/${id}/approve`, { approvedBy, status })
};

export const statisticsApi = {
  get: (unitId: string, period: 'daily' | 'weekly' | 'monthly', startDate: string, endDate: string) =>
    api.get<Statistics[]>('/statistics', { params: { unitId, period, startDate, endDate } }),
  exportPDF: (unitId: string, period: 'daily' | 'weekly' | 'monthly', startDate: string, endDate: string) =>
    api.get('/statistics/export-pdf', { params: { unitId, period, startDate, endDate }, responseType: 'arraybuffer' })
};

export const approvalRequestApi = {
  getAll: () => api.get<ApprovalRequest[]>('/approval-requests')
};

export const gridLoadForecastApi = {
  get: (date?: string) => api.get('/grid-load-forecast', { params: { date } })
};

export default api;
