import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Table,
  Space,
  Typography,
  Progress,
  Badge,
  Tooltip
} from 'antd';
import {
  ThunderboltOutlined,
  WarningOutlined,
  SafetyOutlined,
  ToolOutlined,
  DashboardOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  AlertOutlined,
  EnvironmentOutlined,
  RiseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  FundOutlined,
  FireOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import { useAppStore } from '../store';
import { Unit, Alarm, RadiationReading } from '../../shared/types';

const { Text } = Typography;

type SystemStatus = 'normal' | 'warning' | 'fault' | 'emergency';
type GlobalStatus = 'normal' | 'warning' | 'danger' | 'emergency';

interface SystemInfo {
  name: string;
  key: string;
  status: SystemStatus;
  description: string;
}

const STATUS_COLOR_MAP: Record<SystemStatus | GlobalStatus, string> = {
  normal: '#52c41a',
  warning: '#faad14',
  fault: '#ff7a45',
  danger: '#ff7a45',
  emergency: '#ff4d4f'
};

const STATUS_TEXT_MAP: Record<SystemStatus | GlobalStatus, string> = {
  normal: '正常',
  warning: '预警',
  fault: '故障',
  danger: '存在危险报警',
  emergency: '紧急'
};

const GLOBAL_STATUS_TEXT: Record<GlobalStatus, string> = {
  normal: '系统运行正常',
  warning: '存在预警信息',
  danger: '存在危险报警',
  emergency: '紧急情况'
};

const getPowerLevelColor = (unit: Unit): string => {
  if (unit.status !== 'operational') return '#1677ff';
  const level = unit.currentPowerLevel;
  if (level < 30) return '#1677ff';
  if (level < 60) return '#52c41a';
  if (level < 85) return '#faad14';
  if (level < 95) return '#ff7a45';
  return '#ff4d4f';
};

const getPowerLevelBg = (unit: Unit): string => {
  if (unit.status !== 'operational') return 'rgba(22, 119, 255, 0.15)';
  const level = unit.currentPowerLevel;
  if (level < 30) return 'rgba(22, 119, 255, 0.15)';
  if (level < 60) return 'rgba(82, 196, 26, 0.15)';
  if (level < 85) return 'rgba(250, 173, 20, 0.15)';
  if (level < 95) return 'rgba(255, 122, 69, 0.15)';
  return 'rgba(255, 77, 79, 0.15)';
};

const ALARM_TYPE_MAP: Record<string, string> = {
  neutron_flux: '中子通量异常',
  coolant_temp: '冷却剂温度异常',
  coolant_pressure: '冷却剂压力异常',
  main_pump: '主泵运行异常',
  radiation: '辐射超标'
};

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    units,
    realtimeData,
    alarms,
    maintenanceOrders,
    radiationReadings,
    generationPlans,
    lowStockItems
  } = useAppStore();

  const [currentTime, setCurrentTime] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const onlineUnits = useMemo(() => 
    units.filter(u => u.status === 'operational').length,
    [units]
  );

  const totalPower = useMemo(() => 
    units.reduce((sum, u) => sum + (u.status === 'operational' ? u.power * u.currentPowerLevel / 100 : 0), 0),
    [units]
  );

  const unacknowledgedAlarms = useMemo(() => 
    alarms.filter(a => !a.acknowledged).length,
    [alarms]
  );

  const inProgressOrders = useMemo(() => 
    maintenanceOrders.filter(o => o.status === 'in_progress').length,
    [maintenanceOrders]
  );

  const pendingOrders = useMemo(() => 
    maintenanceOrders.filter(o => o.status === 'pending').length,
    [maintenanceOrders]
  );

  const criticalOrders = useMemo(() => 
    maintenanceOrders.filter(o => o.priority === 'critical' && o.status !== 'completed').length,
    [maintenanceOrders]
  );

  const globalStatus = useMemo((): GlobalStatus => {
    const unacked = alarms.filter(a => !a.acknowledged);
    if (unacked.some(a => a.level === 'emergency')) return 'emergency';
    if (unacked.some(a => a.level === 'danger')) return 'danger';
    if (unacked.some(a => a.level === 'warning')) return 'warning';
    return 'normal';
  }, [alarms]);

  const radiationStatus = useMemo(() => {
    const latestReadings = radiationReadings.slice(-20);
    const hasExceeded = latestReadings.some(r => r.doseRate > r.alarmThreshold);
    return hasExceeded ? '超标' : '正常';
  }, [radiationReadings]);

  const avgRadiation = useMemo(() => {
    const calcAvg = (type: string) => {
      const filtered = radiationReadings.filter(r => r.locationType === type);
      if (filtered.length === 0) return 0;
      return filtered.reduce((sum, r) => sum + r.doseRate, 0) / filtered.length;
    };
    return {
      plant: calcAvg('plant'),
      perimeter: calcAvg('perimeter'),
      surrounding: calcAvg('surrounding')
    };
  }, [radiationReadings]);

  const systemStatuses = useMemo((): SystemInfo[] => {
    const getSystemStatus = (category: string): SystemStatus => {
      const relevantAlarms = alarms.filter(a => {
        if (category === 'reactor') return a.type === 'neutron_flux';
        if (category === 'coolant') return a.type === 'coolant_temp' || a.type === 'coolant_pressure' || a.type === 'main_pump';
        if (category === 'radiation') return a.type === 'radiation';
        return false;
      });
      const unacked = relevantAlarms.filter(a => !a.acknowledged);
      if (unacked.some(a => a.level === 'emergency')) return 'emergency';
      if (unacked.some(a => a.level === 'danger')) return 'fault';
      if (unacked.some(a => a.level === 'warning')) return 'warning';
      return 'normal';
    };

    return [
      { name: '反应堆系统', key: 'reactor', status: getSystemStatus('reactor'), description: '反应堆核心运行状态' },
      { name: '冷却剂系统', key: 'coolant', status: getSystemStatus('coolant'), description: '一回路冷却剂循环' },
      { name: '汽轮机系统', key: 'turbine', status: 'normal', description: '蒸汽轮机运行状态' },
      { name: '发电机系统', key: 'generator', status: 'normal', description: '电力输出状态' },
      { name: '电气系统', key: 'electrical', status: 'normal', description: '厂用电系统' },
      { name: '辐射监测系统', key: 'radiation', status: getSystemStatus('radiation'), description: '辐射剂量监测' },
      { name: '安全防护系统', key: 'safety', status: 'normal', description: '安全壳与应急系统' }
    ];
  }, [alarms]);

  const recentAlarms = useMemo(() => 
    [...alarms]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10),
    [alarms]
  );

  const generationPlanData = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const todayPlans = generationPlans.filter(p => p.date === today && p.status === 'approved');
    
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const planData: number[] = new Array(24).fill(0);
    const actualData: number[] = new Array(24).fill(0);

    todayPlans.forEach(plan => {
      plan.hourlyPlan.forEach(hp => {
        planData[hp.hour] += hp.targetPower;
      });
    });

    const currentHour = dayjs().hour();
    units.forEach(unit => {
      if (unit.status === 'operational') {
        for (let i = 0; i <= currentHour; i++) {
          actualData[i] += unit.power * unit.currentPowerLevel / 100;
        }
      }
    });

    const totalPlan = planData.reduce((a, b) => a + b, 0);
    const totalActual = actualData.reduce((a, b) => a + b, 0);
    const completionRate = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
    const deviation = totalActual - totalPlan;

    return { hours, planData, actualData, completionRate, deviation };
  }, [generationPlans, units]);

  const neutronFluxOption = useMemo((): EChartsOption => {
    const operationalUnits = units.filter(u => u.status === 'operational');
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: operationalUnits.map(u => `${u.unitNo}号`),
        axisLabel: { color: '#aaa', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        name: '中子通量',
        nameTextStyle: { color: '#aaa', fontSize: 10 },
        axisLabel: { 
          color: '#aaa', 
          fontSize: 10,
          formatter: (v: number) => {
            if (v >= 1e12) return `${(v / 1e12).toFixed(1)}e12`;
            if (v >= 1e9) return `${(v / 1e9).toFixed(1)}e9`;
            return v.toString();
          }
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: [{
        type: 'bar',
        data: operationalUnits.map(u => {
          const data = realtimeData[u.id];
          return {
            value: data?.neutronFlux || 0,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: '#1677ff' },
                  { offset: 1, color: '#52c41a' }
                ]
              }
            }
          };
        }),
        barWidth: '50%',
        animationDuration: 1000
      }]
    };
  }, [units, realtimeData]);

  const coolantTempOption = useMemo((): EChartsOption => {
    const operationalUnits = units.filter(u => u.status === 'operational');
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: operationalUnits.map(u => `${u.unitNo}号`),
        axisLabel: { color: '#aaa', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        name: '温度 (℃)',
        nameTextStyle: { color: '#aaa', fontSize: 10 },
        min: 260,
        max: 340,
        axisLabel: { color: '#aaa', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: [{
        type: 'bar',
        data: operationalUnits.map(u => {
          const data = realtimeData[u.id];
          const temp = data?.coolantTemp || 0;
          let color = '#52c41a';
          if (temp > 325) color = '#ff4d4f';
          else if (temp > 315) color = '#faad14';
          return { value: temp, itemStyle: { color } };
        }),
        barWidth: '50%',
        markLine: {
          silent: true,
          lineStyle: { color: '#faad14', type: 'dashed' },
          data: [{ yAxis: 315 }, { yAxis: 325, lineStyle: { color: '#ff4d4f' } }]
        },
        animationDuration: 1000
      }]
    };
  }, [units, realtimeData]);

  const pressureTrendOption = useMemo((): EChartsOption => {
    const operationalUnits = units.filter(u => u.status === 'operational');
    const colors = ['#1677ff', '#52c41a', '#faad14', '#ff7a45', '#722ed1', '#13c2c2'];
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: operationalUnits.map(u => `${u.unitNo}号机组`),
        textStyle: { color: '#aaa', fontSize: 10 },
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: Array.from({ length: 10 }, (_, i) => `${i * 2}s前`).reverse(),
        axisLabel: { color: '#aaa', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: '压力 (MPa)',
        nameTextStyle: { color: '#aaa', fontSize: 10 },
        min: 130,
        max: 180,
        axisLabel: { color: '#aaa', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: operationalUnits.map((unit, index) => ({
        name: `${unit.unitNo}号机组`,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: Array.from({ length: 10 }, () => {
          const data = realtimeData[unit.id];
          const base = data?.coolantPressure || 155;
          return base + (Math.random() - 0.5) * 4;
        }),
        lineStyle: { width: 2, color: colors[index % colors.length] },
        itemStyle: { color: colors[index % colors.length] },
        areaStyle: {
          opacity: 0.1,
          color: colors[index % colors.length]
        }
      })),
      animationDuration: 1000
    };
  }, [units, realtimeData]);

  const radiationChartOption = useMemo((): EChartsOption => {
    const latestByLocation = radiationReadings.reduce((acc, r) => {
      acc[r.location] = r;
      return acc;
    }, {} as Record<string, RadiationReading>);
    
    const readings = Object.values(latestByLocation);
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0];
          const reading = readings[data.dataIndex];
          return `${data.name}<br/>剂量率: ${data.value.toFixed(4)} ${reading.unit}<br/>阈值: ${reading.alarmThreshold.toFixed(4)} ${reading.unit}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: readings.map(r => r.location),
        axisLabel: { color: '#aaa', fontSize: 10, rotate: 30 }
      },
      yAxis: {
        type: 'value',
        name: '剂量率 (μSv/h)',
        nameTextStyle: { color: '#aaa', fontSize: 10 },
        axisLabel: { color: '#aaa', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: [{
        type: 'bar',
        data: readings.map(r => ({
          value: r.doseRate,
          itemStyle: {
            color: r.doseRate > r.alarmThreshold ? '#ff4d4f' : '#52c41a'
          }
        })),
        barWidth: '60%',
        markLine: {
          silent: true,
          lineStyle: { color: '#ff4d4f', type: 'dashed' },
          data: readings.length > 0 ? [{ yAxis: readings[0].alarmThreshold }] : [],
          label: { formatter: '报警阈值', color: '#ff4d4f', fontSize: 10 }
        },
        animationDuration: 1000
      }]
    };
  }, [radiationReadings]);

  const generationPlanOption = useMemo((): EChartsOption => {
    const { hours, planData, actualData } = generationPlanData;
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['计划出力', '实际出力'],
        textStyle: { color: '#aaa', fontSize: 11 },
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: hours.map(h => `${h}:00`),
        axisLabel: { color: '#aaa', fontSize: 10, rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: '功率 (MW)',
        nameTextStyle: { color: '#aaa', fontSize: 10 },
        axisLabel: { color: '#aaa', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: [
        {
          name: '计划出力',
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: planData,
          lineStyle: { width: 2, color: '#1677ff', type: 'dashed' },
          areaStyle: {
            opacity: 0.1,
            color: '#1677ff'
          }
        },
        {
          name: '实际出力',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: actualData,
          lineStyle: { width: 3, color: '#52c41a' },
          itemStyle: { color: '#52c41a' },
          areaStyle: {
            opacity: 0.2,
            color: '#52c41a'
          }
        }
      ],
      animationDuration: 1000
    };
  }, [generationPlanData]);

  const handleUnitClick = (unitId: string) => {
    navigate('/monitoring', { state: { selectedUnitId: unitId } });
  };

  const alarmColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 140,
      render: (t: string) => dayjs(t).format('MM-DD HH:mm:ss')
    },
    {
      title: '机组',
      dataIndex: 'unitId',
      key: 'unitId',
      width: 70,
      render: (id: string) => {
        const unit = units.find(u => u.id === id);
        return unit ? `${unit.unitNo}号` : '-';
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => ALARM_TYPE_MAP[type] || type
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 70,
      render: (level: Alarm['level']) => {
        const color = level === 'warning' ? 'gold' : level === 'danger' ? 'orange' : 'red';
        const text = level === 'warning' ? '预警' : level === 'danger' ? '危险' : '紧急';
        return (
          <Tag 
            color={color}
            className={level === 'emergency' ? 'alarm-flash' : ''}
            style={{ fontWeight: 'bold', margin: 0 }}
          >
            {text}
          </Tag>
        );
      }
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (msg: string) => (
        <Tooltip title={msg}>
          <span>{msg}</span>
        </Tooltip>
      )
    }
  ];

  const darkCardStyle = {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12
  };

  return (
    <div style={{ 
      background: '#0a0a1a', 
      minHeight: '100%', 
      margin: '-24px', 
      padding: '24px',
      color: '#fff'
    }}>
      <div style={{
        position: 'fixed',
        top: 64,
        left: 220,
        right: 0,
        zIndex: 1000,
        padding: '12px 24px',
        background: STATUS_COLOR_MAP[globalStatus],
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        animation: globalStatus === 'emergency' ? 'flash 1s infinite' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <Space size="middle">
          {globalStatus === 'normal' && <CheckCircleOutlined />}
          {globalStatus === 'warning' && <ExclamationCircleOutlined />}
          {globalStatus === 'danger' && <WarningOutlined />}
          {globalStatus === 'emergency' && <CloseCircleOutlined />}
          <span>{GLOBAL_STATUS_TEXT[globalStatus]}</span>
          {globalStatus !== 'normal' && (
            <Tag color="white" style={{ margin: 0 }}>
              {unacknowledgedAlarms} 条未处理报警
            </Tag>
          )}
        </Space>
        <Text style={{ color: '#fff', margin: 0 }}>
          <ClockCircleOutlined style={{ marginRight: 8 }} />
          {currentTime.format('YYYY年MM月DD日 HH:mm:ss')}
        </Text>
      </div>

      <div style={{ marginTop: 60 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card style={darkCardStyle} size="small">
              <Statistic
                title={<Text style={{ color: '#aaa' }}>在线机组</Text>}
                value={onlineUnits}
                suffix={`/ ${units.length}`}
                prefix={<ThunderboltOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card style={darkCardStyle} size="small">
              <Statistic
                title={<Text style={{ color: '#aaa' }}>总发电功率</Text>}
                value={totalPower}
                suffix="MW"
                precision={1}
                prefix={<DashboardOutlined style={{ color: '#1677ff' }} />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card style={darkCardStyle} size="small">
              <Statistic
                title={<Text style={{ color: '#aaa' }}>未处理报警</Text>}
                value={unacknowledgedAlarms}
                prefix={<AlertOutlined />}
                valueStyle={{ color: unacknowledgedAlarms > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card style={darkCardStyle} size="small">
              <Statistic
                title={<Text style={{ color: '#aaa' }}>进行中工单</Text>}
                value={inProgressOrders}
                prefix={<ToolOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card style={darkCardStyle} size="small">
              <Statistic
                title={<Text style={{ color: '#aaa' }}>辐射状态</Text>}
                value={radiationStatus}
                prefix={<SafetyOutlined style={{ color: radiationStatus === '正常' ? '#52c41a' : '#ff4d4f' }} />}
                valueStyle={{ color: radiationStatus === '正常' ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card style={darkCardStyle} size="small">
              <Statistic
                title={<Text style={{ color: '#aaa' }}>计划完成率</Text>}
                value={generationPlanData.completionRate}
                suffix="%"
                precision={1}
                prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: generationPlanData.completionRate >= 95 ? '#52c41a' : '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card 
              title={
                <Space>
                  <ThunderboltOutlined style={{ color: '#1677ff' }} />
                  <span>机组状态热力分布</span>
                </Space>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
              bodyStyle={{ padding: '16px' }}
            >
              <Row gutter={[12, 12]}>
                {units.map(unit => {
                  const color = getPowerLevelColor(unit);
                  const bg = getPowerLevelBg(unit);
                  const data = realtimeData[unit.id];
                  
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} xl={4} key={unit.id}>
                      <div
                        className="heatmap-cell"
                        onClick={() => handleUnitClick(unit.id)}
                        style={{
                          background: bg,
                          border: `2px solid ${color}`,
                          borderRadius: 12,
                          padding: '16px',
                          cursor: 'pointer',
                          boxShadow: `0 0 20px ${color}33`,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '60px',
                          height: '60px',
                          background: color,
                          opacity: 0.1,
                          borderRadius: '0 0 0 60px'
                        }} />
                        
                        <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                          <Tag 
                            color={color}
                            style={{ 
                              fontSize: 14, 
                              fontWeight: 'bold',
                              padding: '4px 12px',
                              margin: 0
                            }}
                          >
                            {unit.unitNo}号机组
                          </Tag>
                          <span className={`status-indicator status-${unit.status}`} style={{ margin: 0 }} />
                        </Row>

                        <div style={{ marginBottom: 8 }}>
                          <Text style={{ color: '#aaa', fontSize: 12 }}>当前功率</Text>
                          <div style={{ 
                            fontSize: 24, 
                            fontWeight: 'bold', 
                            color: color,
                            fontFamily: 'Courier New, monospace'
                          }}>
                            {unit.status === 'operational' 
                              ? (unit.power * unit.currentPowerLevel / 100).toFixed(1)
                              : '0.0'
                            }
                            <span style={{ fontSize: 14, color: '#888' }}> / {unit.power} MW</span>
                          </div>
                        </div>

                        <Progress 
                          percent={unit.currentPowerLevel}
                          showInfo={true}
                          strokeColor={color}
                          trailColor="rgba(255,255,255,0.1)"
                          size="small"
                          style={{ marginBottom: 12 }}
                        />

                        <Row justify="space-between" style={{ marginBottom: 8 }}>
                          <Text style={{ color: '#aaa', fontSize: 11 }}>燃料寿期</Text>
                          <Text style={{ color: '#fff', fontSize: 11 }}>{unit.fuelRodLife}%</Text>
                        </Row>

                        <Tag 
                          style={{ 
                            width: '100%', 
                            textAlign: 'center',
                            margin: 0,
                            background: `${color}22`,
                            color: color,
                            borderColor: color
                          }}
                        >
                          {unit.status === 'operational' ? '运行中' :
                           unit.status === 'maintenance' ? '维护中' :
                           unit.status === 'shutdown' ? '已停堆' : '换料中'}
                        </Tag>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <DashboardOutlined style={{ color: '#1677ff' }} />
                  <span>中子通量</span>
                </Space>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
              size="small"
            >
              <ReactECharts 
                option={neutronFluxOption} 
                style={{ height: '280px' }} 
                notMerge
                theme="dark"
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <FireOutlined style={{ color: '#ff7a45' }} />
                  <span>冷却剂温度</span>
                </Space>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
              size="small"
            >
              <ReactECharts 
                option={coolantTempOption} 
                style={{ height: '280px' }} 
                notMerge
                theme="dark"
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <FundOutlined style={{ color: '#52c41a' }} />
                  <span>冷却剂压力趋势</span>
                </Space>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
              size="small"
            >
              <ReactECharts 
                option={pressureTrendOption} 
                style={{ height: '280px' }} 
                notMerge
                theme="dark"
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={10}>
            <Card 
              title={
                <Space>
                  <ApartmentOutlined style={{ color: '#722ed1' }} />
                  <span>系统状态热力分布</span>
                </Space>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Row gutter={[12, 12]}>
                {systemStatuses.map(system => (
                  <Col xs={12} sm={8} key={system.key}>
                    <div
                      style={{
                        background: `${STATUS_COLOR_MAP[system.status]}22`,
                        border: `2px solid ${STATUS_COLOR_MAP[system.status]}`,
                        borderRadius: 8,
                        padding: '16px',
                        textAlign: 'center',
                        transition: 'all 0.3s ease',
                        boxShadow: `0 0 15px ${STATUS_COLOR_MAP[system.status]}22`,
                        animation: system.status === 'emergency' ? 'flash 1s infinite' : 'none'
                      }}
                    >
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: STATUS_COLOR_MAP[system.status],
                        margin: '0 auto 8px',
                        boxShadow: `0 0 10px ${STATUS_COLOR_MAP[system.status]}`
                      }} />
                      <Text strong style={{ color: '#fff', fontSize: 13, display: 'block', marginBottom: 4 }}>
                        {system.name}
                      </Text>
                      <Tag 
                        color={STATUS_COLOR_MAP[system.status]}
                        style={{ margin: 0, fontSize: 11 }}
                      >
                        {STATUS_TEXT_MAP[system.status]}
                      </Tag>
                      <div style={{ marginTop: 8 }}>
                        <Text style={{ color: '#888', fontSize: 10 }}>
                          {system.description}
                        </Text>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={14}>
            <Card 
              title={
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  <span>最近报警</span>
                  <Badge count={unacknowledgedAlarms} size="small" />
                </Space>
              }
              extra={
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<EyeOutlined />}
                  onClick={() => navigate('/monitoring')}
                >
                  查看全部
                </Button>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Table
                size="small"
                dataSource={recentAlarms}
                columns={alarmColumns}
                rowKey="id"
                pagination={false}
                scroll={{ y: 280 }}
                rowClassName={(record) => {
                  if (!record.acknowledged) {
                    return record.level === 'emergency' ? 'table-row-danger alarm-flash' :
                           record.level === 'danger' ? 'table-row-danger' :
                           'table-row-warning';
                  }
                  return '';
                }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <ToolOutlined style={{ color: '#faad14' }} />
                  <span>维保工单概览</span>
                </Space>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <div style={{
                    background: 'rgba(250, 173, 20, 0.15)',
                    border: '1px solid #faad14',
                    borderRadius: 8,
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <Text style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
                      待处理
                    </Text>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#faad14' }}>
                      {pendingOrders}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{
                    background: 'rgba(22, 119, 255, 0.15)',
                    border: '1px solid #1677ff',
                    borderRadius: 8,
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <Text style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
                      进行中
                    </Text>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1677ff' }}>
                      {inProgressOrders}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{
                    background: 'rgba(255, 77, 79, 0.15)',
                    border: '1px solid #ff4d4f',
                    borderRadius: 8,
                    padding: '16px',
                    textAlign: 'center',
                    animation: criticalOrders > 0 ? 'pulse 2s infinite' : 'none'
                  }}>
                    <Text style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
                      紧急工单
                    </Text>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>
                      {criticalOrders}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{
                    background: 'rgba(255, 122, 69, 0.15)',
                    border: '1px solid #ff7a45',
                    borderRadius: 8,
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <Text style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
                      低库存备件
                    </Text>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff7a45' }}>
                      {lowStockItems.length}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <SafetyOutlined style={{ color: radiationStatus === '正常' ? '#52c41a' : '#ff4d4f' }} />
                  <span>辐射监测概览</span>
                </Space>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <ReactECharts 
                option={radiationChartOption} 
                style={{ height: '200px', marginBottom: 16 }} 
                notMerge
                theme="dark"
              />
              <Row gutter={[8, 8]}>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, display: 'block' }}>厂区平均</Text>
                    <Text strong style={{ color: '#fff', fontSize: 14 }}>
                      {avgRadiation.plant.toFixed(4)} μSv/h
                    </Text>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, display: 'block' }}>边界平均</Text>
                    <Text strong style={{ color: '#fff', fontSize: 14 }}>
                      {avgRadiation.perimeter.toFixed(4)} μSv/h
                    </Text>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, display: 'block' }}>周边平均</Text>
                    <Text strong style={{ color: '#fff', fontSize: 14 }}>
                      {avgRadiation.surrounding.toFixed(4)} μSv/h
                    </Text>
                  </div>
                </Col>
              </Row>
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Tag 
                  color={radiationStatus === '正常' ? 'green' : 'red'}
                  style={{ fontSize: 13, padding: '4px 16px' }}
                >
                  <EnvironmentOutlined style={{ marginRight: 4 }} />
                  辐射状态: {radiationStatus}
                </Tag>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card 
              title={
                <Space>
                  <BarChartOutlined style={{ color: '#52c41a' }} />
                  <span>发电计划执行</span>
                </Space>
              }
              style={darkCardStyle}
              headStyle={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <ReactECharts 
                option={generationPlanOption} 
                style={{ height: '200px', marginBottom: 16 }} 
                notMerge
                theme="dark"
              />
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(82, 196, 26, 0.15)', borderRadius: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>
                      计划完成率
                    </Text>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                      {generationPlanData.completionRate.toFixed(1)}%
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(250, 173, 20, 0.15)', borderRadius: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 4 }}>
                      偏差分析
                    </Text>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: generationPlanData.deviation >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      {generationPlanData.deviation >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {' '}{Math.abs(generationPlanData.deviation).toFixed(1)} MW
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <div style={{ 
          textAlign: 'center', 
          padding: '16px',
          color: '#666',
          fontSize: 12
        }}>
          <Space size="large">
            <span><ReloadOutlined style={{ marginRight: 4, animation: 'spin 1s linear infinite' }} />实时数据每2秒自动刷新</span>
            <span>数据来源: 核电站DCS系统</span>
            <span>最后更新: {currentTime.format('HH:mm:ss')}</span>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
