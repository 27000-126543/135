import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Select,
  Table,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  Empty,
  Badge
} from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs from 'dayjs';
import { useAppStore } from '../store';
import { RealtimeData, Alarm, Unit } from '../../shared/types';
import { alarmApi, realtimeDataApi } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

type ParameterStatus = 'normal' | 'warning' | 'danger' | 'emergency';

interface ParameterConfig {
  key: keyof RealtimeData;
  name: string;
  unit: string;
  min: number;
  max: number;
  normalMin: number;
  normalMax: number;
  warningMin: number;
  warningMax: number;
  dangerMin: number;
  dangerMax: number;
}

const PARAMETER_CONFIGS: ParameterConfig[] = [
  {
    key: 'neutronFlux',
    name: '中子通量',
    unit: 'n/cm²/s',
    min: 0,
    max: 2e13,
    normalMin: 1e12,
    normalMax: 1.2e13,
    warningMin: 8e11,
    warningMax: 1.4e13,
    dangerMin: 5e11,
    dangerMax: 1.7e13
  },
  {
    key: 'coolantTemp',
    name: '冷却剂温度',
    unit: '℃',
    min: 200,
    max: 350,
    normalMin: 280,
    normalMax: 315,
    warningMin: 270,
    warningMax: 325,
    dangerMin: 260,
    dangerMax: 335
  },
  {
    key: 'coolantPressure',
    name: '冷却剂压力',
    unit: 'MPa',
    min: 100,
    max: 200,
    normalMin: 140,
    normalMax: 165,
    warningMin: 135,
    warningMax: 170,
    dangerMin: 130,
    dangerMax: 175
  },
  {
    key: 'mainPumpSpeed',
    name: '主泵转速',
    unit: 'RPM',
    min: 1000,
    max: 2000,
    normalMin: 1400,
    normalMax: 1600,
    warningMin: 1350,
    warningMax: 1650,
    dangerMin: 1300,
    dangerMax: 1700
  },
  {
    key: 'controlRodPosition',
    name: '控制棒位置',
    unit: '%',
    min: 0,
    max: 100,
    normalMin: 0,
    normalMax: 100,
    warningMin: 0,
    warningMax: 100,
    dangerMin: 0,
    dangerMax: 100
  }
];

const ALARM_TYPE_MAP: Record<string, string> = {
  neutron_flux: '中子通量异常',
  coolant_temp: '冷却剂温度异常',
  coolant_pressure: '冷却剂压力异常',
  main_pump: '主泵运行异常',
  radiation: '辐射超标'
};

const STATUS_COLOR_MAP: Record<ParameterStatus, string> = {
  normal: '#52c41a',
  warning: '#faad14',
  danger: '#ff7a45',
  emergency: '#ff4d4f'
};

const STATUS_TEXT_MAP: Record<ParameterStatus, string> = {
  normal: '正常',
  warning: '预警',
  danger: '危险',
  emergency: '紧急'
};

const getParameterStatus = (value: number, config: ParameterConfig): ParameterStatus => {
  if (value >= config.normalMin && value <= config.normalMax) return 'normal';
  if (value >= config.warningMin && value <= config.warningMax) return 'warning';
  if (value >= config.dangerMin && value <= config.dangerMax) return 'danger';
  return 'emergency';
};

const formatValue = (value: number, unit: string): string => {
  if (unit === 'n/cm²/s') {
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}×10¹²`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}×10⁹`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}×10⁶`;
  }
  return value.toFixed(2);
};

interface GaugeChartProps {
  config: ParameterConfig;
  data: RealtimeData;
  historyData: RealtimeData[];
}

const GaugeChart = ({ config, data, historyData }: GaugeChartProps) => {
  const value = data[config.key] as number;
  const status = getParameterStatus(value, config);
  const color = STATUS_COLOR_MAP[status];

  const option: EChartsOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: config.min,
        max: config.max,
        splitNumber: 10,
        center: ['50%', '60%'],
        radius: '85%',
        itemStyle: {
          color: color
        },
        progress: {
          show: true,
          width: 12,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: STATUS_COLOR_MAP.normal },
                { offset: 0.7, color: STATUS_COLOR_MAP.warning },
                { offset: 0.9, color: STATUS_COLOR_MAP.danger },
                { offset: 1, color: STATUS_COLOR_MAP.emergency }
              ]
            }
          }
        },
        pointer: {
          show: true,
          length: '60%',
          width: 6,
          itemStyle: {
            color: color
          }
        },
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [0.5, '#f0f0f0'],
              [0.75, '#fff1f0'],
              [1, '#fff2f0']
            ]
          }
        },
        axisTick: {
          distance: -15,
          splitNumber: 5,
          lineStyle: {
            width: 1,
            color: '#999'
          }
        },
        splitLine: {
          distance: -18,
          length: 10,
          lineStyle: {
            width: 2,
            color: '#666'
          }
        },
        axisLabel: {
          distance: 25,
          color: '#666',
          fontSize: 10,
          formatter: (v: number) => {
            if (config.unit === 'n/cm²/s') {
              if (v === 0) return '0';
              if (v === 1e12) return '1e12';
              if (v === 2e13) return '2e13';
            }
            return v.toString();
          }
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 16,
          itemStyle: {
            borderWidth: 3,
            borderColor: color
          }
        },
        title: {
          show: false
        },
        detail: {
          valueAnimation: true,
          fontSize: 18,
          fontWeight: 'bold',
          offsetCenter: [0, '25%'],
          formatter: [`{value|${formatValue(value, config.unit)}}`, `{unit|${config.unit}}`].join('\n'),
          rich: {
            value: {
              fontSize: 20,
              fontWeight: 'bold',
              color: color,
              lineHeight: 30
            },
            unit: {
              fontSize: 12,
              color: '#666',
              lineHeight: 20
            }
          }
        },
        data: [{ value }]
      }
    ]
  };

  return (
    <div className="gauge-container">
      <ReactECharts option={option} style={{ height: '220px' }} notMerge />
    </div>
  );
};

const RealtimeMonitoring = () => {
  const { units, realtimeData, alarms, setRealtimeData, setAlarms, acknowledgeAlarm } = useAppStore();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [historyData, setHistoryData] = useState<RealtimeData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (units.length > 0 && !selectedUnitId) {
      setSelectedUnitId(units[0].id);
    }
  }, [units, selectedUnitId]);

  const currentData = useMemo(() => {
    return realtimeData[selectedUnitId] || {
      unitId: selectedUnitId,
      timestamp: new Date().toISOString(),
      neutronFlux: 0,
      coolantTemp: 0,
      coolantPressure: 0,
      mainPumpSpeed: 0,
      controlRodPosition: 0
    };
  }, [realtimeData, selectedUnitId]);

  const fetchRealtimeData = useCallback(async () => {
    if (!selectedUnitId) return;
    try {
      const res = await realtimeDataApi.getByUnit(selectedUnitId);
      const dataArray = res.data;
      if (dataArray.length > 0) {
        const latest = dataArray[dataArray.length - 1];
        setRealtimeData(selectedUnitId, latest);
        setHistoryData(prev => {
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          const filtered = [...prev, latest].filter(
            d => new Date(d.timestamp).getTime() > fiveMinutesAgo
          );
          return filtered.slice(-150);
        });
      }
    } catch (error) {
      console.error('Failed to fetch realtime data:', error);
    }
  }, [selectedUnitId, setRealtimeData]);

  const fetchAlarms = useCallback(async () => {
    try {
      const res = await alarmApi.getAll();
      setAlarms(res.data);
    } catch (error) {
      console.error('Failed to fetch alarms:', error);
    }
  }, [setAlarms]);

  useEffect(() => {
    if (selectedUnitId) {
      setLoading(true);
      Promise.all([fetchRealtimeData(), fetchAlarms()]).finally(() => {
        setLoading(false);
      });
    }
  }, [selectedUnitId, fetchRealtimeData, fetchAlarms]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchRealtimeData();
      fetchAlarms();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchRealtimeData, fetchAlarms]);

  const handleAcknowledge = async (alarmId: string) => {
    try {
      await alarmApi.acknowledge(alarmId);
      acknowledgeAlarm(alarmId);
    } catch (error) {
      console.error('Failed to acknowledge alarm:', error);
    }
  };

  const handleAcknowledgeAll = async () => {
    const unacknowledged = unitAlarms.filter(a => !a.acknowledged);
    for (const alarm of unacknowledged) {
      await handleAcknowledge(alarm.id);
    }
  };

  const unitAlarms = useMemo(() => {
    return alarms
      .filter(a => a.unitId === selectedUnitId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alarms, selectedUnitId]);

  const protectionActions = useMemo(() => {
    return unitAlarms
      .filter(a => a.autoActionTaken)
      .map(a => ({
        id: a.id,
        time: a.timestamp,
        action: a.autoActionTaken!,
        level: a.level
      }))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [unitAlarms]);

  const trendOption = useMemo((): EChartsOption => {
    const times = historyData.map(d => dayjs(d.timestamp).format('HH:mm:ss'));
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: PARAMETER_CONFIGS.map(c => c.name),
        top: 0,
        textStyle: { fontSize: 11 }
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
        data: times,
        axisLabel: { fontSize: 10, rotate: 45 }
      },
      yAxis: [
        {
          type: 'value',
          name: '温度/压力/转速',
          position: 'left',
          axisLabel: { fontSize: 10 }
        },
        {
          type: 'value',
          name: '中子通量',
          position: 'right',
          axisLabel: { 
            fontSize: 10,
            formatter: (v: number) => {
              if (v >= 1e12) return `${(v / 1e12).toFixed(1)}e12`;
              if (v >= 1e9) return `${(v / 1e9).toFixed(1)}e9`;
              return v.toString();
            }
          }
        }
      ],
      series: PARAMETER_CONFIGS.map((config, index) => ({
        name: config.name,
        type: 'line',
        smooth: true,
        symbol: 'none',
        yAxisIndex: config.key === 'neutronFlux' ? 1 : 0,
        data: historyData.map(d => d[config.key] as number),
        lineStyle: { width: 2 },
        emphasis: { focus: 'series' }
      }))
    };
  }, [historyData]);

  const alarmColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '报警类型',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type: string) => ALARM_TYPE_MAP[type] || type
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: Alarm['level']) => {
        const color = level === 'warning' ? 'gold' : level === 'danger' ? 'orange' : 'red';
        const text = level === 'warning' ? '预警' : level === 'danger' ? '危险' : '紧急';
        return (
          <Tag 
            color={color}
            className={level === 'emergency' ? 'alarm-flash' : ''}
            style={{ fontWeight: 'bold' }}
          >
            <WarningOutlined /> {text}
          </Tag>
        );
      }
    },
    {
      title: '数值',
      dataIndex: 'value',
      key: 'value',
      width: 120,
      render: (v: number, record: Alarm) => {
        const config = PARAMETER_CONFIGS.find(c => 
          c.key.replace(/([A-Z])/g, '_$1').toLowerCase().startsWith(record.type.split('_').slice(0, -1).join('_')) ||
          record.type.includes(c.key)
        );
        return config ? `${formatValue(v, config.unit)} ${config.unit}` : v.toFixed(2);
      }
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 120,
      render: (v: number, record: Alarm) => {
        const config = PARAMETER_CONFIGS.find(c => 
          c.key.replace(/([A-Z])/g, '_$1').toLowerCase().startsWith(record.type.split('_').slice(0, -1).join('_'))
        );
        return config ? `${formatValue(v, config.unit)} ${config.unit}` : v.toFixed(2);
      }
    },
    {
      title: '状态',
      dataIndex: 'acknowledged',
      key: 'acknowledged',
      width: 100,
      render: (ack: boolean) => (
        <Tag color={ack ? 'green' : 'red'} icon={ack ? <CheckCircleOutlined /> : <ClockCircleOutlined />}>
          {ack ? '已确认' : '未确认'}
        </Tag>
      )
    },
    {
      title: '自动保护动作',
      dataIndex: 'autoActionTaken',
      key: 'autoActionTaken',
      width: 180,
      render: (action?: string) => action || <Text type="secondary">无</Text>
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: Alarm) => (
        <Button
          type="primary"
          size="small"
          disabled={record.acknowledged}
          onClick={() => handleAcknowledge(record.id)}
        >
          确认
        </Button>
      )
    }
  ];

  const selectedUnit = units.find(u => u.id === selectedUnitId);

  const overallStatus = useMemo((): ParameterStatus => {
    const statuses = PARAMETER_CONFIGS.map(c => 
      getParameterStatus(currentData[c.key] as number, c)
    );
    const priority: ParameterStatus[] = ['emergency', 'danger', 'warning', 'normal'];
    for (const s of priority) {
      if (statuses.includes(s)) return s;
    }
    return 'normal';
  }, [currentData]);

  if (units.length === 0) {
    return <Empty description="暂无机组数据" />;
  }

  return (
    <div style={{ padding: 0 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size="large" align="center">
                <Title level={4} style={{ margin: 0 }}>
                  <SafetyOutlined style={{ marginRight: 8 }} />
                  反应堆实时监测与报警
                </Title>
                <Tag color={STATUS_COLOR_MAP[overallStatus]} style={{ fontSize: 14, padding: '4px 12px' }}>
                  整体状态：{STATUS_TEXT_MAP[overallStatus]}
                </Tag>
              </Space>
              <Space size="middle" align="center">
                <Text type="secondary">
                  <ReloadOutlined spin style={{ marginRight: 4 }} />
                  每2秒自动刷新
                </Text>
                <Select
                  value={selectedUnitId}
                  onChange={setSelectedUnitId}
                  style={{ width: 200 }}
                  size="large"
                  placeholder="选择机组"
                >
                  {units.map(unit => (
                    <Option key={unit.id} value={unit.id}>
                      <Space>
                        <span className={`status-indicator status-${unit.status}`} />
                        {unit.unitNo}号机组 - {unit.power}MW
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      {selectedUnit && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card bordered={false} size="small">
              <Statistic
                title="机组功率"
                value={selectedUnit.currentPowerLevel}
                suffix="%"
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} size="small">
              <Statistic
                title="运行状态"
                value={selectedUnit.status === 'operational' ? '运行中' : 
                       selectedUnit.status === 'maintenance' ? '维护中' :
                       selectedUnit.status === 'shutdown' ? '已停堆' : '换料中'}
                valueStyle={{ color: selectedUnit.status === 'operational' ? '#52c41a' : '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} size="small">
              <Statistic
                title="累计运行"
                value={selectedUnit.operatingHours}
                suffix="小时"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} size="small">
              <Statistic
                title="未确认报警"
                value={unitAlarms.filter(a => !a.acknowledged).length}
                valueStyle={{ color: unitAlarms.filter(a => !a.acknowledged).length > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card 
            title={
              <Space>
                <span>关键参数仪表盘</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  最后更新: {dayjs(currentData.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </Space>
            }
            bordered={false}
          >
            <Row gutter={[8, 8]}>
              {PARAMETER_CONFIGS.map(config => {
                const value = currentData[config.key] as number;
                const status = getParameterStatus(value, config);
                return (
                  <Col key={config.key} xs={24} sm={12} md={8} lg={4.8}>
                    <Card 
                      bordered
                      size="small"
                      style={{ 
                        borderRadius: 8,
                        borderColor: status === 'normal' ? '#f0f0f0' : STATUS_COLOR_MAP[status],
                        background: status === 'emergency' ? '#fff1f0' : 
                                   status === 'danger' ? '#fff7e6' :
                                   status === 'warning' ? '#fffbe6' : 'white'
                      }}
                    >
                      <div style={{ textAlign: 'center', marginBottom: 4 }}>
                        <Space>
                          <span 
                            className={`status-indicator ${status === 'normal' ? 'status-operational' : ''}`}
                            style={{ 
                              background: STATUS_COLOR_MAP[status],
                              boxShadow: `0 0 8px ${STATUS_COLOR_MAP[status]}`,
                              animation: status === 'emergency' ? 'flash 1s infinite' : 'none'
                            }}
                          />
                          <Text strong>{config.name}</Text>
                          <Tag color={STATUS_COLOR_MAP[status]} style={{ margin: 0 }}>
                            {STATUS_TEXT_MAP[status]}
                          </Tag>
                        </Space>
                      </div>
                      <GaugeChart 
                        config={config} 
                        data={currentData} 
                        historyData={historyData} 
                      />
                      <div style={{ textAlign: 'center', marginTop: -20 }}>
                        <Tooltip title={`正常范围: ${formatValue(config.normalMin, config.unit)} - ${formatValue(config.normalMax, config.unit)} ${config.unit}`}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            正常: {formatValue(config.normalMin, config.unit)} - {formatValue(config.normalMax, config.unit)}
                          </Text>
                        </Tooltip>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card 
            title="实时趋势曲线 (最近5分钟)"
            bordered={false}
            extra={<Text type="secondary">共 {historyData.length} 个数据点</Text>}
          >
            <ReactECharts 
              option={trendOption} 
              style={{ height: '350px' }} 
              notMerge 
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card 
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                <span>报警列表</span>
                <Badge count={unitAlarms.filter(a => !a.acknowledged).length} size="small" />
              </Space>
            }
            bordered={false}
            extra={
              <Button 
                type="primary" 
                size="small"
                disabled={unitAlarms.filter(a => !a.acknowledged).length === 0}
                onClick={handleAcknowledgeAll}
              >
                一键确认全部
              </Button>
            }
          >
            <Table
              size="small"
              dataSource={unitAlarms}
              columns={alarmColumns}
              rowKey="id"
              scroll={{ y: 400 }}
              rowClassName={(record) => {
                if (!record.acknowledged) {
                  return record.level === 'emergency' ? 'table-row-danger alarm-flash' :
                         record.level === 'danger' ? 'table-row-danger' :
                         'table-row-warning';
                }
                return '';
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条报警`
              }}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            title={
              <Space>
                <SafetyOutlined style={{ color: '#1677ff' }} />
                <span>自动保护动作记录</span>
              </Space>
            }
            bordered={false}
          >
            {protectionActions.length === 0 ? (
              <Empty 
                description="暂无保护动作" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '40px 0' }}
              />
            ) : (
              <div style={{ maxHeight: 450, overflowY: 'auto' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {protectionActions.slice(0, 20).map((action, index) => (
                    <div 
                      key={action.id}
                      style={{
                        padding: '12px',
                        borderRadius: 8,
                        background: action.level === 'emergency' ? '#fff1f0' :
                                   action.level === 'danger' ? '#fff7e6' : '#fffbe6',
                        borderLeft: `4px solid ${
                          action.level === 'emergency' ? '#ff4d4f' :
                          action.level === 'danger' ? '#fa8c16' : '#faad14'
                        }`
                      }}
                    >
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Tag color={
                            action.level === 'emergency' ? 'red' :
                            action.level === 'danger' ? 'orange' : 'gold'
                          }>
                            #{index + 1}
                          </Tag>
                        </Col>
                        <Col>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(action.time).format('HH:mm:ss')}
                          </Text>
                        </Col>
                      </Row>
                      <div style={{ marginTop: 4, fontSize: 13 }}>
                        <Text strong>{action.action}</Text>
                      </div>
                    </div>
                  ))}
                </Space>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RealtimeMonitoring;
