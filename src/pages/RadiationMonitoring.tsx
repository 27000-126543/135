import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Typography,
  Progress,
  List,
  Modal,
  Form,
  InputNumber,
  message,
  Badge,
  Alert,
  Popconfirm
} from 'antd';
import {
  WarningOutlined,
  SafetyOutlined,
  AlertOutlined,
  UserOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import { useAppStore } from '../store';
import { RadiationReading, EvacuationStatus, User } from '../../shared/types';
import { radiationApi } from '../services/api';

const { Title, Text } = Typography;

const MONITORING_LOCATIONS = [
  { name: '反应堆厂房', type: 'plant' as const, x: 2, y: 2 },
  { name: '汽轮机厂房', type: 'plant' as const, x: 4, y: 2 },
  { name: '厂区边界1', type: 'perimeter' as const, x: 0, y: 1 },
  { name: '厂区边界2', type: 'perimeter' as const, x: 6, y: 3 },
  { name: '周边居民区1', type: 'surrounding' as const, x: 0, y: 4 },
  { name: '周边居民区2', type: 'surrounding' as const, x: 6, y: 0 }
];

const ALARM_THRESHOLDS: Record<string, number> = {
  plant: 100,
  perimeter: 10,
  surrounding: 1
};

const LOCATION_TYPE_MAP: Record<string, string> = {
  plant: '厂区',
  perimeter: '边界',
  surrounding: '周边'
};

const getDoseRateColor = (doseRate: number, threshold: number): string => {
  const ratio = doseRate / threshold;
  if (ratio < 0.3) return '#52c41a';
  if (ratio < 0.6) return '#73d13d';
  if (ratio < 0.8) return '#faad14';
  if (ratio < 1.0) return '#fa8c16';
  return '#ff4d4f';
};

const getStatusColor = (doseRate: number, threshold: number): string => {
  return doseRate >= threshold ? 'error' : 'success';
};

const getStatusText = (doseRate: number, threshold: number): string => {
  return doseRate >= threshold ? '超标' : '正常';
};

const getHeatmapColor = (value: number, threshold: number): string[] => {
  const ratio = value / threshold;
  if (ratio < 0.3) return ['#95de64', '#52c41a'];
  if (ratio < 0.6) return ['#f0f500', '#faad14'];
  if (ratio < 0.8) return ['#faad14', '#fa8c16'];
  if (ratio < 1.0) return ['#fa8c16', '#ff7a45'];
  return ['#ff4d4f', '#cf1322'];
};

interface HeatmapDataPoint {
  name: string;
  value: [number, number, number];
  itemStyle: { color: string };
}

const RadiationMonitoring = () => {
  const {
    user,
    radiationReadings,
    evacuationStatus,
    setRadiationReadings,
    setEvacuationStatus,
    addEvacuationStatus,
    updateEvacuationStatus
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [evacuationModalVisible, setEvacuationModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [evacuationForm] = Form.useForm();
  const [updateForm] = Form.useForm();
  const [selectedEvacuation, setSelectedEvacuation] = useState<EvacuationStatus | null>(null);
  const [radiationHistory, setRadiationHistory] = useState<Record<string, RadiationReading[]>>({});

  const hasPermission = useMemo(() => {
    return user?.role === 'radiation_officer' || user?.role === 'admin';
  }, [user]);

  const activeEvacuation = useMemo(() => {
    return evacuationStatus.find(e => e.status === 'initiated' || e.status === 'in_progress');
  }, [evacuationStatus]);

  const exceededReadings = useMemo(() => {
    return radiationReadings.filter(r => r.doseRate >= r.alarmThreshold);
  }, [radiationReadings]);

  const hasActiveAlarm = exceededReadings.length > 0;

  const fetchRadiationReadings = useCallback(async () => {
    try {
      const res = await radiationApi.getAll();
      setRadiationReadings(res.data);
      
      setRadiationHistory(prev => {
        const newHistory = { ...prev };
        res.data.forEach(reading => {
          if (!newHistory[reading.location]) {
            newHistory[reading.location] = [];
          }
          const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
          const filtered = [...newHistory[reading.location], reading]
            .filter(r => new Date(r.timestamp).getTime() > twentyFourHoursAgo)
            .slice(-720);
          newHistory[reading.location] = filtered;
        });
        return newHistory;
      });
    } catch (error) {
      console.error('Failed to fetch radiation readings:', error);
    }
  }, [setRadiationReadings]);

  const fetchEvacuationStatus = useCallback(async () => {
    try {
      const res = await radiationApi.getEvacuationStatus();
      setEvacuationStatus(res.data);
    } catch (error) {
      console.error('Failed to fetch evacuation status:', error);
    }
  }, [setEvacuationStatus]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRadiationReadings(), fetchEvacuationStatus()]);
    } finally {
      setLoading(false);
    }
  }, [fetchRadiationReadings, fetchEvacuationStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchRadiationReadings();
      fetchEvacuationStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchRadiationReadings, fetchEvacuationStatus]);

  useEffect(() => {
    if (hasActiveAlarm && !activeEvacuation && hasPermission) {
      const emergencyReading = exceededReadings.find(r => 
        r.doseRate >= r.alarmThreshold * 2 || 
        (r.locationType === 'surrounding' && r.doseRate >= r.alarmThreshold)
      );
      if (emergencyReading) {
        message.error('紧急情况：检测到严重辐射超标，已自动启动疏散流程！');
        handleAutoEvacuation();
      }
    }
  }, [hasActiveAlarm, activeEvacuation, hasPermission, exceededReadings]);

  const handleAutoEvacuation = async () => {
    const affectedZones = exceededReadings.map(r => r.location);
    const personnelCount = affectedZones.length * 50;
    
    const newEvacuation: EvacuationStatus = {
      id: `evac_${Date.now()}`,
      alarmId: `alarm_${Date.now()}`,
      status: 'initiated',
      affectedZones,
      personnelCount,
      safePersonnelCount: 0,
      startTime: new Date().toISOString()
    };

    try {
      const res = await radiationApi.createEvacuation(newEvacuation);
      addEvacuationStatus(res.data);
    } catch (error) {
      console.error('Failed to auto-start evacuation:', error);
    }
  };

  const handleCreateEvacuation = async (values: any) => {
    const affectedZones = MONITORING_LOCATIONS
      .filter(loc => loc.type === 'plant' || loc.type === 'perimeter')
      .map(loc => loc.name);

    const newEvacuation: EvacuationStatus = {
      id: `evac_${Date.now()}`,
      alarmId: values.alarmId || `alarm_${Date.now()}`,
      status: 'initiated',
      affectedZones,
      personnelCount: values.personnelCount || 200,
      safePersonnelCount: 0,
      startTime: new Date().toISOString()
    };

    try {
      const res = await radiationApi.createEvacuation(newEvacuation);
      addEvacuationStatus(res.data);
      setEvacuationModalVisible(false);
      evacuationForm.resetFields();
      message.success('疏散已启动');
    } catch (error: any) {
      message.error('启动疏散失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleStartEvacuation = async () => {
    if (!activeEvacuation) return;
    try {
      const res = await radiationApi.updateEvacuation(
        activeEvacuation.id,
        activeEvacuation.safePersonnelCount,
        'in_progress'
      );
      updateEvacuationStatus(res.data);
      message.success('疏散已开始进行');
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdateProgress = async (values: any) => {
    if (!selectedEvacuation) return;
    try {
      const newCount = Math.min(
        selectedEvacuation.personnelCount,
        selectedEvacuation.safePersonnelCount + values.additionalCount
      );
      const newStatus = newCount >= selectedEvacuation.personnelCount ? 'completed' : selectedEvacuation.status;
      const endTime = newStatus === 'completed' ? new Date().toISOString() : undefined;

      const res = await radiationApi.updateEvacuation(
        selectedEvacuation.id,
        newCount,
        newStatus,
        endTime
      );
      updateEvacuationStatus(res.data);
      setUpdateModalVisible(false);
      updateForm.resetFields();
      message.success('疏散进度已更新');
    } catch (error: any) {
      message.error('更新失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleEndEvacuation = async () => {
    if (!activeEvacuation) return;
    try {
      const res = await radiationApi.updateEvacuation(
        activeEvacuation.id,
        activeEvacuation.safePersonnelCount,
        'completed',
        new Date().toISOString()
      );
      updateEvacuationStatus(res.data);
      message.success('疏散已结束');
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCancelEvacuation = async () => {
    if (!activeEvacuation) return;
    try {
      const res = await radiationApi.updateEvacuation(
        activeEvacuation.id,
        activeEvacuation.safePersonnelCount,
        'cancelled',
        new Date().toISOString()
      );
      updateEvacuationStatus(res.data);
      message.info('疏散已取消');
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const heatmapData = useMemo((): HeatmapDataPoint[] => {
    return MONITORING_LOCATIONS.map(loc => {
      const reading = radiationReadings.find(r => r.location === loc.name);
      const value = reading?.doseRate || 0;
      const threshold = reading?.alarmThreshold || ALARM_THRESHOLDS[loc.type];
      const color = getDoseRateColor(value, threshold);
      return {
        name: loc.name,
        value: [loc.x, loc.y, value],
        itemStyle: { color }
      };
    });
  }, [radiationReadings]);

  const heatmapOption = useMemo((): EChartsOption => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = params.data as HeatmapDataPoint;
          const reading = radiationReadings.find(r => r.location === data.name);
          const threshold = reading?.alarmThreshold || 10;
          const status = getStatusText(data.value[2], threshold);
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${data.name}</div>
              <div>当前剂量率: <span style="color: ${data.itemStyle.color}; font-weight: bold;">${data.value[2].toFixed(4)} μSv/h</span></div>
              <div>报警阈值: ${threshold} μSv/h</div>
              <div>状态: <span style="color: ${getStatusColor(data.value[2], threshold) === 'error' ? '#ff4d4f' : '#52c41a'};">${status}</span></div>
            </div>
          `;
        }
      },
      grid: {
        left: '5%',
        right: '5%',
        top: '5%',
        bottom: '5%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['西', '', '中', '', '', '', '东'],
        splitLine: { show: true },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 12 }
      },
      yAxis: {
        type: 'category',
        data: ['北', '', '中', '', '南'],
        splitLine: { show: true },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 12 }
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 60,
          label: {
            show: true,
            formatter: (params: any) => {
              const data = params.data as HeatmapDataPoint;
              return `${data.name}\n${data.value[2].toFixed(3)}`;
            },
            fontSize: 11,
            fontWeight: 'bold',
            color: '#fff',
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowBlur: 2
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          data: heatmapData
        }
      ]
    };
  }, [heatmapData, radiationReadings]);

  const trendOption = useMemo((): EChartsOption => {
    const locations = Object.keys(radiationHistory);
    const colors = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];

    const allTimestamps = new Set<string>();
    locations.forEach(loc => {
      radiationHistory[loc].forEach(r => {
        allTimestamps.add(dayjs(r.timestamp).format('HH:mm'));
      });
    });
    const sortedTimestamps = Array.from(allTimestamps).sort();

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: locations,
        top: 0,
        textStyle: { fontSize: 11 }
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
        boundaryGap: false,
        data: sortedTimestamps,
        axisLabel: { fontSize: 10, rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: '剂量率 (μSv/h)',
        axisLabel: { 
          fontSize: 10,
          formatter: (v: number) => v.toFixed(3)
        }
      },
      series: locations.map((loc, index) => {
        const reading = radiationReadings.find(r => r.location === loc);
        const threshold = reading?.alarmThreshold || 10;
        const locationData = sortedTimestamps.map(time => {
          const record = radiationHistory[loc].find(
            r => dayjs(r.timestamp).format('HH:mm') === time
          );
          return record ? record.doseRate : null;
        });

        return {
          name: loc,
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: colors[index % colors.length] },
          lineStyle: { width: 2 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#ff4d4f',
              type: 'dashed',
              width: 1
            },
            data: [{ yAxis: threshold, label: { formatter: `阈值 ${threshold}`, fontSize: 10 } }]
          },
          data: locationData
        };
      })
    };
  }, [radiationHistory, radiationReadings]);

  const tableColumns = [
    {
      title: '监测位置',
      dataIndex: 'location',
      key: 'location',
      width: 140,
      render: (loc: string, record: RadiationReading) => (
        <Space>
          <EnvironmentOutlined style={{ color: getDoseRateColor(record.doseRate, record.alarmThreshold) }} />
          <Text strong>{loc}</Text>
        </Space>
      )
    },
    {
      title: '位置类型',
      dataIndex: 'locationType',
      key: 'locationType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'plant' ? 'blue' : type === 'perimeter' ? 'gold' : 'green'}>
          {LOCATION_TYPE_MAP[type]}
        </Tag>
      )
    },
    {
      title: '当前剂量率 (μSv/h)',
      dataIndex: 'doseRate',
      key: 'doseRate',
      width: 160,
      render: (value: number, record: RadiationReading) => {
        const color = getDoseRateColor(value, record.alarmThreshold);
        const isExceeded = value >= record.alarmThreshold;
        return (
          <Text strong style={{ color, fontSize: 15 }} className={isExceeded ? 'alarm-flash' : ''}>
            {value.toFixed(4)}
          </Text>
        );
      },
      sorter: (a: RadiationReading, b: RadiationReading) => a.doseRate - b.doseRate
    },
    {
      title: '报警阈值 (μSv/h)',
      dataIndex: 'alarmThreshold',
      key: 'alarmThreshold',
      width: 140,
      render: (value: number) => <Text type="secondary">{value}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_: unknown, record: RadiationReading) => {
        const isExceeded = record.doseRate >= record.alarmThreshold;
        return (
          <Badge 
            status={isExceeded ? 'error' : 'success'} 
            text={isExceeded ? '超标' : '正常'}
            className={isExceeded ? 'alarm-flash' : ''}
          />
        );
      }
    },
    {
      title: '最后更新时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div style={{ padding: 0 }}>
      {hasActiveAlarm && (
        <Alert
          message={
            <Space className="alarm-flash">
              <WarningOutlined style={{ fontSize: 20 }} />
              <span style={{ fontSize: 16, fontWeight: 'bold' }}>
                辐射报警！当前有 {exceededReadings.length} 个监测点辐射超标
              </span>
            </Space>
          }
          description={
            <Space direction="vertical" size="small">
              {exceededReadings.map(r => (
                <Text key={r.id} type="danger">
                  • {r.location}: {r.doseRate.toFixed(4)} μSv/h (阈值: {r.alarmThreshold} μSv/h)
                </Text>
              ))}
            </Space>
          }
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16, border: '2px solid #ff4d4f' }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size="large" align="center">
                <Title level={4} style={{ margin: 0 }}>
                  <AlertOutlined style={{ marginRight: 8, color: hasActiveAlarm ? '#ff4d4f' : '#1677ff' }} />
                  辐射监测与人员疏散
                </Title>
                {hasActiveAlarm ? (
                  <Tag color="red" className="alarm-flash" style={{ fontSize: 14, padding: '4px 12px' }}>
                    <WarningOutlined /> 辐射超标
                  </Tag>
                ) : (
                  <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                    <SafetyOutlined /> 辐射水平正常
                  </Tag>
                )}
              </Space>
              <Space size="middle" align="center">
                <Text type="secondary">
                  <ReloadOutlined spin style={{ marginRight: 4 }} />
                  每2秒自动刷新
                </Text>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="监测点总数"
              value={radiationReadings.length}
              prefix={<EnvironmentOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="超标监测点"
              value={exceededReadings.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: exceededReadings.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="疏散状态"
              value={activeEvacuation ? (activeEvacuation.status === 'in_progress' ? '进行中' : '已启动') : '无'}
              prefix={activeEvacuation ? <WarningOutlined /> : <CheckCircleOutlined />}
              valueStyle={{ color: activeEvacuation ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} size="small">
            <Statistic
              title="已安全撤离"
              value={activeEvacuation ? activeEvacuation.safePersonnelCount : 0}
              suffix={activeEvacuation ? `/${activeEvacuation.personnelCount}` : ''}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card 
            title={
              <Space>
                <EnvironmentOutlined />
                <span>区域辐射热力图</span>
              </Space>
            }
            bordered={false}
            extra={
              <Space size="small">
                <Tag color="#52c41a">安全</Tag>
                <Tag color="#faad14">注意</Tag>
                <Tag color="#fa8c16">警告</Tag>
                <Tag color="#ff4d4f">危险</Tag>
              </Space>
            }
          >
            <ReactECharts 
              option={heatmapOption} 
              style={{ height: '380px' }} 
              notMerge 
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            title={
              <Space>
                <UserOutlined />
                <span>人员疏散管理</span>
              </Space>
            }
            bordered={false}
            extra={
              <Space>
                {!activeEvacuation && hasPermission && (
                  <Button 
                    type="primary" 
                    danger
                    icon={<PlayCircleOutlined />}
                    onClick={() => setEvacuationModalVisible(true)}
                  >
                    启动疏散
                  </Button>
                )}
                {activeEvacuation && hasPermission && activeEvacuation.status === 'initiated' && (
                  <Button 
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleStartEvacuation}
                  >
                    开始疏散
                  </Button>
                )}
                {activeEvacuation && hasPermission && (
                  <Button 
                    icon={<TeamOutlined />}
                    onClick={() => {
                      setSelectedEvacuation(activeEvacuation);
                      setUpdateModalVisible(true);
                    }}
                  >
                    更新进度
                  </Button>
                )}
                {activeEvacuation && hasPermission && activeEvacuation.status === 'in_progress' && (
                  <Popconfirm
                    title="确认结束疏散？"
                    description="请确认所有人员已安全撤离"
                    onConfirm={handleEndEvacuation}
                    okText="确认结束"
                    cancelText="取消"
                  >
                    <Button type="primary" icon={<CheckCircleOutlined />}>
                      结束疏散
                    </Button>
                  </Popconfirm>
                )}
                {activeEvacuation && hasPermission && (
                  <Popconfirm
                    title="确认取消疏散？"
                    description="取消后疏散状态将被标记为已取消"
                    onConfirm={handleCancelEvacuation}
                    okText="确认取消"
                    cancelText="继续"
                    okType="danger"
                  >
                    <Button danger icon={<CloseCircleOutlined />}>
                      取消疏散
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            }
          >
            {activeEvacuation ? (
              <div>
                <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: activeEvacuation.status === 'in_progress' ? '#fff7e6' : '#e6f7ff' }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text strong>疏散状态</Text>
                    </Col>
                    <Col>
                      <Tag color={activeEvacuation.status === 'in_progress' ? 'orange' : activeEvacuation.status === 'completed' ? 'green' : 'blue'}>
                        {activeEvacuation.status === 'initiated' ? '已启动' : 
                         activeEvacuation.status === 'in_progress' ? '进行中' :
                         activeEvacuation.status === 'completed' ? '已完成' : '已取消'}
                      </Tag>
                    </Col>
                  </Row>
                  <Row justify="space-between" align="middle" style={{ marginTop: 8 }}>
                    <Col>
                      <Text type="secondary">开始时间</Text>
                    </Col>
                    <Col>
                      <Text>{dayjs(activeEvacuation.startTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
                    </Col>
                  </Row>
                  {activeEvacuation.endTime && (
                    <Row justify="space-between" align="middle" style={{ marginTop: 4 }}>
                      <Col>
                        <Text type="secondary">结束时间</Text>
                      </Col>
                      <Col>
                        <Text>{dayjs(activeEvacuation.endTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
                      </Col>
                    </Row>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <Row justify="space-between" style={{ marginBottom: 8 }}>
                    <Col>
                      <Text strong>疏散进度</Text>
                    </Col>
                    <Col>
                      <Text strong style={{ color: '#52c41a' }}>
                        {activeEvacuation.safePersonnelCount} / {activeEvacuation.personnelCount} 人
                      </Text>
                    </Col>
                  </Row>
                  <Progress 
                    percent={Math.round((activeEvacuation.safePersonnelCount / activeEvacuation.personnelCount) * 100)}
                    strokeColor={{
                      '0%': '#52c41a',
                      '100%': '#73d13d'
                    }}
                    strokeWidth={14}
                  />
                </div>

                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    <EnvironmentOutlined style={{ marginRight: 4 }} />
                    影响区域 ({activeEvacuation.affectedZones.length})
                  </Text>
                  <List
                    size="small"
                    dataSource={activeEvacuation.affectedZones}
                    renderItem={(zone) => (
                      <List.Item>
                        <Space>
                          <Badge status="warning" />
                          <Text>{zone}</Text>
                        </Space>
                      </List.Item>
                    )}
                    style={{ maxHeight: 150, overflowY: 'auto' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <SafetyOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
                <Text type="secondary">当前无疏散进行</Text>
                {hasPermission && (
                  <div style={{ marginTop: 16 }}>
                    <Button 
                      type="primary" 
                      danger
                      icon={<PlayCircleOutlined />}
                      onClick={() => setEvacuationModalVisible(true)}
                    >
                      启动疏散
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card 
            title={
              <Space>
                <AlertOutlined />
                <span>实时辐射读数</span>
                <Badge count={exceededReadings.length} size="small" offset={[4, -2]} />
              </Space>
            }
            bordered={false}
            extra={
              <Text type="secondary">
                阈值: 厂区 {ALARM_THRESHOLDS.plant}μSv/h | 边界 {ALARM_THRESHOLDS.perimeter}μSv/h | 周边 {ALARM_THRESHOLDS.surrounding}μSv/h
              </Text>
            }
          >
            <Table
              size="middle"
              dataSource={radiationReadings}
              columns={tableColumns}
              rowKey="id"
              loading={loading}
              rowClassName={(record) => {
                if (record.doseRate >= record.alarmThreshold) {
                  return 'table-row-danger alarm-flash';
                }
                return '';
              }}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            title={
              <Space>
                <ReloadOutlined />
                <span>辐射趋势曲线 (最近24小时)</span>
              </Space>
            }
            bordered={false}
            extra={
              <Text type="secondary">
                共 {Object.values(radiationHistory).flat().length} 个历史数据点
              </Text>
            }
          >
            <ReactECharts 
              option={trendOption} 
              style={{ height: '400px' }} 
              notMerge 
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="启动人员疏散"
        open={evacuationModalVisible}
        onCancel={() => {
          setEvacuationModalVisible(false);
          evacuationForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Alert
          message="疏散预警"
          description="启动疏散将通知相关区域人员紧急撤离，请确认操作。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={evacuationForm}
          layout="vertical"
          onFinish={handleCreateEvacuation}
        >
          <Form.Item
            name="personnelCount"
            label="预估疏散人数"
            initialValue={200}
            rules={[{ required: true, message: '请输入预估疏散人数' }]}
          >
            <InputNumber 
              min={1} 
              max={5000} 
              style={{ width: '100%' }} 
              addonAfter="人"
            />
          </Form.Item>
          <Form.Item
            name="alarmId"
            label="关联报警ID (可选)"
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入关联的报警ID" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setEvacuationModalVisible(false);
                evacuationForm.resetFields();
              }}>
                取消
              </Button>
              <Button 
                type="primary" 
                danger 
                htmlType="submit"
                icon={<PlayCircleOutlined />}
              >
                确认启动疏散
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="更新疏散进度"
        open={updateModalVisible}
        onCancel={() => {
          setUpdateModalVisible(false);
          updateForm.resetFields();
        }}
        footer={null}
        width={450}
      >
        {selectedEvacuation && (
          <div style={{ marginBottom: 16 }}>
            <Row justify="space-between" style={{ marginBottom: 8 }}>
              <Col><Text type="secondary">当前已安全撤离:</Text></Col>
              <Col><Text strong>{selectedEvacuation.safePersonnelCount} 人</Text></Col>
            </Row>
            <Row justify="space-between" style={{ marginBottom: 8 }}>
              <Col><Text type="secondary">总人数:</Text></Col>
              <Col><Text>{selectedEvacuation.personnelCount} 人</Text></Col>
            </Row>
            <Row justify="space-between">
              <Col><Text type="secondary">剩余待撤离:</Text></Col>
              <Col>
                <Text style={{ color: '#faad14' }}>
                  {selectedEvacuation.personnelCount - selectedEvacuation.safePersonnelCount} 人
                </Text>
              </Col>
            </Row>
          </div>
        )}
        <Form
          form={updateForm}
          layout="vertical"
          onFinish={handleUpdateProgress}
        >
          <Form.Item
            name="additionalCount"
            label="新增安全撤离人数"
            initialValue={10}
            rules={[{ required: true, message: '请输入新增安全撤离人数' }]}
          >
            <InputNumber 
              min={1} 
              max={selectedEvacuation ? selectedEvacuation.personnelCount - selectedEvacuation.safePersonnelCount : 100} 
              style={{ width: '100%' }} 
              addonAfter="人"
            />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setUpdateModalVisible(false);
                updateForm.resetFields();
              }}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                icon={<TeamOutlined />}
              >
                确认更新
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RadiationMonitoring;
