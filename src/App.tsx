import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Badge, Dropdown, Button, Space, App as AntApp } from 'antd';
import {
  DashboardOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  AlertOutlined,
  SafetyOutlined,
  ToolOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import io from 'socket.io-client';
import { useAppStore } from './store';
import { RealtimeData, Alarm, RadiationReading, EvacuationStatus, GenerationPlan, ShiftSwapRequest } from '../shared/types';
import Dashboard from './pages/Dashboard';
import UnitManagement from './pages/UnitManagement';
import GenerationPlanPage from './pages/GenerationPlanPage';
import RealtimeMonitoring from './pages/RealtimeMonitoring';
import EquipmentMaintenance from './pages/EquipmentMaintenance';
import RadiationMonitoring from './pages/RadiationMonitoring';
import Scheduling from './pages/Scheduling';
import StatisticsPage from './pages/StatisticsPage';
import {
  unitApi,
  generationPlanApi,
  alarmApi,
  equipmentApi,
  maintenanceOrderApi,
  inventoryApi,
  radiationApi,
  employeeApi,
  shiftApi,
  shiftSwapRequestApi,
  approvalRequestApi
} from './services/api';

const { Header, Sider, Content } = Layout;

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { notification } = AntApp.useApp();
  const {
    user,
    setUnits,
    setGenerationPlans,
    setRealtimeData,
    setAlarms,
    addAlarm,
    acknowledgeAlarm,
    setEquipment,
    setMaintenanceOrders,
    setInventory,
    setLowStockItems,
    setRadiationReadings,
    addRadiationReading,
    setEvacuationStatus,
    addEvacuationStatus,
    updateEvacuationStatus,
    setEmployees,
    setShifts,
    setShiftSwapRequests,
    setApprovalRequests,
    alarms
  } = useAppStore();

  let socket: ReturnType<typeof io> | null = null;

  useEffect(() => {
    loadInitialData();
    initSocket();
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const [
        unitsRes,
        plansRes,
        alarmsRes,
        equipmentRes,
        ordersRes,
        inventoryRes,
        lowStockRes,
        radiationRes,
        evacuationRes,
        employeesRes,
        shiftsRes,
        swapRes,
        approvalRes
      ] = await Promise.all([
        unitApi.getAll(),
        generationPlanApi.getAll(),
        alarmApi.getAll(),
        equipmentApi.getAll(),
        maintenanceOrderApi.getAll(),
        inventoryApi.getAll(),
        inventoryApi.getLowStock(),
        radiationApi.getAll(),
        radiationApi.getEvacuationStatus(),
        employeeApi.getAll(),
        shiftApi.getAll(),
        shiftSwapRequestApi.getAll(),
        approvalRequestApi.getAll()
      ]);

      setUnits(unitsRes.data);
      setGenerationPlans(plansRes.data);
      setAlarms(alarmsRes.data);
      setEquipment(equipmentRes.data);
      setMaintenanceOrders(ordersRes.data);
      setInventory(inventoryRes.data);
      setLowStockItems(lowStockRes.data);
      setRadiationReadings(radiationRes.data);
      setEvacuationStatus(evacuationRes.data);
      setEmployees(employeesRes.data);
      setShifts(shiftsRes.data);
      setShiftSwapRequests(swapRes.data);
      setApprovalRequests(approvalRes.data);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const initSocket = () => {
    socket = io('http://localhost:3001', { transports: ['websocket'] });

    socket.on('realtimeData', (data: RealtimeData) => {
      setRealtimeData(data.unitId, data);
    });

    socket.on('alarm', (alarm: Alarm) => {
      addAlarm(alarm);
      if (alarm.level === 'emergency') {
        notification.error({
          message: '紧急报警',
          description: alarm.message,
          duration: 0,
          placement: 'topRight'
        });
      } else if (alarm.level === 'danger') {
        notification.warning({
          message: '危险报警',
          description: alarm.message,
          duration: 10
        });
      }
    });

    socket.on('protectionAction', (action: any) => {
      notification.info({
        message: '自动保护动作已执行',
        description: action.action
      });
    });

    socket.on('radiationReading', (reading: RadiationReading) => {
      addRadiationReading(reading);
    });

    socket.on('radiationAlarm', (alarm: Alarm) => {
      addAlarm(alarm);
      notification.error({
        message: '辐射超标报警',
        description: alarm.message,
        duration: 0
      });
    });

    socket.on('evacuationInitiated', (evacuation: EvacuationStatus) => {
      addEvacuationStatus(evacuation);
      notification.error({
        message: '人员疏散已启动',
        description: `影响区域: ${evacuation.affectedZones.join(', ')}`,
        duration: 0
      });
    });

    socket.on('evacuationUpdated', (data: any) => {
      updateEvacuationStatus({ id: data.id, safePersonnelCount: data.safePersonnelCount, status: data.status } as EvacuationStatus);
    });

    socket.on('planCreated', (plan: GenerationPlan) => {
      notification.info({
        message: '新发电计划已创建',
        description: plan.notes
      });
    });

    socket.on('planApproved', (data: any) => {
      notification.success({
        message: '发电计划已批准',
        description: `计划ID: ${data.planId}`
      });
    });

    socket.on('swapRequestCreated', (request: ShiftSwapRequest) => {
      notification.info({
        message: '新的换班申请',
        description: `员工ID: ${request.employeeId}`
      });
    });

    socket.on('adjustmentRequested', (data: any) => {
      notification.info({
        message: '计划调整申请',
        description: data.reason
      });
    });

    socket.connect();
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">主控界面</Link>
    },
    {
      key: '/units',
      icon: <ThunderboltOutlined />,
      label: <Link to="/units">机组管理</Link>
    },
    {
      key: '/plans',
      icon: <BarChartOutlined />,
      label: <Link to="/plans">发电计划</Link>
    },
    {
      key: '/monitoring',
      icon: <AlertOutlined />,
      label: <Link to="/monitoring">实时监测</Link>
    },
    {
      key: '/radiation',
      icon: <SafetyOutlined />,
      label: <Link to="/radiation">辐射监测</Link>
    },
    {
      key: '/maintenance',
      icon: <ToolOutlined />,
      label: <Link to="/maintenance">设备维保</Link>
    },
    {
      key: '/scheduling',
      icon: <TeamOutlined />,
      label: <Link to="/scheduling">人员排班</Link>
    },
    {
      key: '/statistics',
      icon: <FileTextOutlined />,
      label: <Link to="/statistics">统计报表</Link>
    }
  ];

  const unacknowledgedAlarms = alarms.filter(a => !a.acknowledged).length;

  const userMenu = {
    items: [
      { key: 'profile', label: '个人信息', icon: <UserOutlined /> },
      { key: 'settings', label: '系统设置', icon: <SettingOutlined /> },
      { type: 'divider' as const },
      { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> }
    ]
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'linear-gradient(90deg, #001529 0%, #002140 100%)',
        padding: '0 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            background: '#1677ff', 
            borderRadius: 8, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white',
            fontSize: 20,
            fontWeight: 'bold'
          }}>
            核
          </div>
          <h1 style={{ color: 'white', margin: 0, fontSize: 20 }}>
            核电站运行调度与安全监控系统
          </h1>
        </div>

        <Space size={24}>
          <Badge count={unacknowledgedAlarms} size="small" offset={[-5, 5]}>
            <Button type="text" icon={<BellOutlined style={{ color: 'white', fontSize: 20 }} />} />
          </Badge>
          <Dropdown menu={userMenu}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span style={{ color: 'white' }}>{user?.name}</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <Layout>
        <Sider
          width={220}
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{ borderRight: '1px solid #f0f0f0' }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>

        <Layout style={{ padding: '16px', background: '#f5f5f5' }}>
          <Content style={{ 
            background: 'white', 
            padding: '24px', 
            borderRadius: 8,
            minHeight: 'calc(100vh - 112px)'
          }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/units" element={<UnitManagement />} />
              <Route path="/plans" element={<GenerationPlanPage />} />
              <Route path="/monitoring" element={<RealtimeMonitoring />} />
              <Route path="/radiation" element={<RadiationMonitoring />} />
              <Route path="/maintenance" element={<EquipmentMaintenance />} />
              <Route path="/scheduling" element={<Scheduling />} />
              <Route path="/statistics" element={<StatisticsPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;
