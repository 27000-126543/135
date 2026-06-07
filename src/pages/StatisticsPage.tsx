import { useState, useMemo, useCallback } from 'react';
import {
  Card,
  Select,
  Table,
  Button,
  DatePicker,
  Space,
  Row,
  Col,
  Statistic,
  Typography,
  Tag,
  Tooltip,
  message,
  Radio,
  Progress,
  Empty,
  Divider
} from 'antd';
import {
  ThunderboltOutlined,
  BarChartOutlined,
  WarningOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  SearchOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import dayjs, { Dayjs } from 'dayjs';
import { useAppStore } from '../store';
import { Statistics } from '../../shared/types';
import { statisticsApi } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

type Period = 'daily' | 'weekly' | 'monthly';
type TrendType = 'monthly' | 'weekly';

const RADIATION_LIMIT = 10;
const TARGET_LOAD_FACTOR = 85;

const formatNumber = (value: number): string => {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const getLoadFactorColor = (value: number): string => {
  if (value < 70) return '#ff4d4f';
  if (value < 85) return '#faad14';
  return '#52c41a';
};

const getLoadFactorStatus = (value: number): string => {
  if (value < 70) return '偏低';
  if (value < 85) return '良好';
  return '优秀';
};

interface OverviewCardProps {
  title: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  comparison?: {
    type: 'percent' | 'value';
    value: number;
    label: string;
    target?: number;
  };
  warning?: boolean;
}

const OverviewCard = ({ title, value, unit, icon, color, comparison, warning }: OverviewCardProps) => {
  return (
    <Card bordered={false} size="small" style={{ borderRadius: 8 }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color
            }}
          >
            {icon}
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
        </Space>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <Text strong style={{ fontSize: 24, color: warning ? '#ff4d4f' : '#1f1f1f' }}>
              {formatNumber(value)}
            </Text>
            <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>{unit}</Text>
          </div>
          {warning && (
            <Tooltip title="数值超标">
              <WarningOutlined style={{ color: '#ff4d4f' }} />
            </Tooltip>
          )}
        </div>
        {comparison && (
          <Space size="small" style={{ fontSize: 12 }}>
            {comparison.type === 'percent' ? (
              <>
                {comparison.value >= 0 ? (
                  <Tag color="green" icon={<RiseOutlined />} style={{ margin: 0 }}>
                    +{formatNumber(comparison.value)}%
                  </Tag>
                ) : (
                  <Tag color="red" icon={<FallOutlined />} style={{ margin: 0 }}>
                    {formatNumber(comparison.value)}%
                  </Tag>
                )}
                <Text type="secondary">{comparison.label}</Text>
              </>
            ) : (
              <>
                {comparison.target !== undefined && (
                  <Progress
                    percent={Math.min(100, (value / comparison.target) * 100)}
                    size="small"
                    strokeColor={color}
                    showInfo={false}
                    style={{ width: 60 }}
                  />
                )}
                <Text type="secondary">
                  {comparison.label}
                  {comparison.target !== undefined && `: ${formatNumber(comparison.target)}${unit}`}
                </Text>
              </>
            )}
          </Space>
        )}
      </Space>
    </Card>
  );
};

const StatisticsPage = () => {
  const { units, statistics, setStatistics } = useAppStore();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('monthly');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(1, 'month').startOf('month'),
    dayjs().subtract(1, 'month').endOf('month')
  ]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [trendType, setTrendType] = useState<TrendType>('monthly');
  const [sortedInfo, setSortedInfo] = useState<any>({});

  const getUnitNo = (unitId: string): string => {
    const unit = units.find(u => u.id === unitId);
    return unit ? unit.unitNo : '未知';
  };

  const handleQuery = useCallback(async () => {
    setLoading(true);
    try {
      const res = await statisticsApi.get(
        selectedUnitId,
        period,
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
      setStatistics(res.data);
      message.success('数据查询成功');
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
      message.error('数据查询失败');
    } finally {
      setLoading(false);
    }
  }, [selectedUnitId, period, dateRange, setStatistics]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const res = await statisticsApi.exportPDF(
        selectedUnitId,
        period,
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `核电站运行报告_${dateRange[0].format('YYYYMMDD')}_${dateRange[1].format('YYYYMMDD')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('PDF导出成功');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      message.error('PDF导出失败');
    } finally {
      setExporting(false);
    }
  }, [selectedUnitId, period, dateRange]);

  const summary = useMemo(() => {
    if (statistics.length === 0) {
      return {
        totalGeneration: 0,
        avgLoadFactor: 0,
        totalOutageCount: 0,
        avgRadiation: 0,
        maxRadiation: 0,
        avgAvailability: 0,
        yoyGrowth: 8.5,
        historicalOutageAvg: 3.2
      };
    }
    const totalGen = statistics.reduce((sum, s) => sum + s.totalGeneration, 0);
    const avgLF = statistics.reduce((sum, s) => sum + s.loadFactor, 0) / statistics.length;
    const totalOutage = statistics.reduce((sum, s) => sum + s.unplannedOutageCount, 0);
    const avgRad = statistics.reduce((sum, s) => sum + s.avgRadiationDose, 0) / statistics.length;
    const maxRad = Math.max(...statistics.map(s => s.maxRadiationDose));
    const avgAvail = statistics.reduce((sum, s) => sum + s.equipmentAvailability, 0) / statistics.length;

    return {
      totalGeneration: totalGen,
      avgLoadFactor: avgLF,
      totalOutageCount: totalOutage,
      avgRadiation: avgRad,
      maxRadiation: maxRad,
      avgAvailability: avgAvail,
      yoyGrowth: 8.5,
      historicalOutageAvg: 3.2
    };
  }, [statistics]);

  const generationBarOption = useMemo((): EChartsOption => {
    const sortedStats = [...statistics].sort((a, b) => b.totalGeneration - a.totalGeneration);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const param = params[0];
          return `${param.name}<br/>发电量: ${formatNumber(param.value)} MWh`;
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
        data: sortedStats.map(s => `${getUnitNo(s.unitId)}号机组`),
        axisLabel: { fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        name: 'MWh',
        axisLabel: { fontSize: 11 }
      },
      series: [{
        type: 'bar',
        data: sortedStats.map(s => s.totalGeneration),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#1677ff' },
              { offset: 1, color: '#69b1ff' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: '50%',
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          formatter: (v: any) => formatNumber(v.value)
        }
      }]
    };
  }, [statistics, units]);

  const loadFactorTrendOption = useMemo((): EChartsOption => {
    const colors = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];
    const unitIds = [...new Set(statistics.map(s => s.unitId))];
    const periods = [...new Set(statistics.map(s => s.endDate))].sort();

    const series = unitIds.map((unitId, index) => ({
      name: `${getUnitNo(unitId)}号机组`,
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      itemStyle: { color: colors[index % colors.length] },
      data: periods.map(p => {
        const stat = statistics.find(s => s.unitId === unitId && s.endDate === p);
        return stat ? stat.loadFactor : null;
      })
    }));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let html = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => {
            if (p.value !== null) {
              html += `${p.marker} ${p.seriesName}: ${p.value}%<br/>`;
            }
          });
          return html;
        }
      },
      legend: {
        data: unitIds.map(id => `${getUnitNo(id)}号机组`),
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
        data: periods.map(p => dayjs(p).format('MM-DD')),
        axisLabel: { fontSize: 10, rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: '%',
        min: 0,
        max: 100,
        axisLabel: { fontSize: 11 },
        splitLine: {
          lineStyle: { type: 'dashed' }
        }
      },
      series
    };
  }, [statistics, units]);

  const outagePieOption = useMemo((): EChartsOption => {
    const data = [
      { value: 35, name: '设备故障', color: '#ff4d4f' },
      { value: 25, name: '定期维护', color: '#faad14' },
      { value: 20, name: '安全检查', color: '#1677ff' },
      { value: 12, name: '换料', color: '#52c41a' },
      { value: 8, name: '其他原因', color: '#8c8c8c' }
    ];
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}次 ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { fontSize: 11 }
      },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold'
          }
        },
        data: data.map(d => ({
          value: d.value,
          name: d.name,
          itemStyle: { color: d.color }
        }))
      }]
    };
  }, []);

  const generationTrendOption = useMemo((): EChartsOption => {
    const months = trendType === 'monthly' ? 12 : 24;
    const xData = trendType === 'monthly'
      ? Array.from({ length: months }, (_, i) => dayjs().subtract(months - 1 - i, 'month').format('YYYY-MM'))
      : Array.from({ length: months }, (_, i) => {
        const d = dayjs().subtract(months - 1 - i, 'week');
        return `${d.format('MM-DD')}`;
      });

    const seriesData = xData.map(() => Math.random() * 20000 + 50000);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          return `${p.name}<br/>发电量: ${formatNumber(p.value)} MWh`;
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
        data: xData,
        axisLabel: { fontSize: 10, rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: 'MWh',
        axisLabel: { fontSize: 11 }
      },
      series: [{
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: seriesData,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#1677ff' },
              { offset: 1, color: '#52c41a' }
            ]
          }
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(22, 119, 255, 0.3)' },
              { offset: 1, color: 'rgba(22, 119, 255, 0.05)' }
            ]
          }
        }
      }]
    };
  }, [trendType]);

  const radiationTrendOption = useMemo((): EChartsOption => {
    const locations = ['反应堆厂房', '汽机房', '控制室', '厂界', '周边居民点'];
    const colors = ['#ff4d4f', '#faad14', '#1677ff', '#52c41a', '#722ed1'];
    const xData = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    const series = locations.map((loc, index) => ({
      name: loc,
      type: 'line' as const,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: colors[index] },
      data: xData.map(() => Math.random() * 3 + (index === 0 ? 4 : index === 4 ? 0.5 : 2))
    }));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let html = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => {
            html += `${p.marker} ${p.seriesName}: ${p.value.toFixed(2)} μSv/h<br/>`;
          });
          return html;
        }
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
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLabel: { fontSize: 10, rotate: 45 }
      },
      yAxis: {
        type: 'value',
        name: 'μSv/h',
        axisLabel: { fontSize: 11 }
      },
      series
    };
  }, []);

  const equipmentStatusPieOption = useMemo((): EChartsOption => {
    const data = [
      { value: 68, name: '正常运行', color: '#52c41a' },
      { value: 18, name: '预警', color: '#faad14' },
      { value: 10, name: '需维护', color: '#ff7a45' },
      { value: 4, name: '故障', color: '#ff4d4f' }
    ];
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}台 ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { fontSize: 11 }
      },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          fontSize: 11,
          formatter: '{b}\n{d}%'
        },
        data: data.map(d => ({
          value: d.value,
          name: d.name,
          itemStyle: { color: d.color }
        }))
      }]
    };
  }, []);

  const tableColumns = [
    {
      title: '机组',
      dataIndex: 'unitId',
      key: 'unitId',
      width: 100,
      render: (id: string) => `${getUnitNo(id)}号机组`
    },
    {
      title: '总发电量',
      dataIndex: 'totalGeneration',
      key: 'totalGeneration',
      width: 140,
      sorter: (a: Statistics, b: Statistics) => a.totalGeneration - b.totalGeneration,
      sortOrder: sortedInfo.columnKey === 'totalGeneration' && sortedInfo.order,
      render: (v: number) => `${formatNumber(v)} MWh`
    },
    {
      title: '负荷因子',
      dataIndex: 'loadFactor',
      key: 'loadFactor',
      width: 120,
      sorter: (a: Statistics, b: Statistics) => a.loadFactor - b.loadFactor,
      sortOrder: sortedInfo.columnKey === 'loadFactor' && sortedInfo.order,
      render: (v: number) => (
        <Tag
          color={v < 70 ? 'red' : v < 85 ? 'gold' : 'green'}
          style={{ margin: 0 }}
        >
          {formatNumber(v)}%
        </Tag>
      )
    },
    {
      title: '非计划停运次数',
      dataIndex: 'unplannedOutageCount',
      key: 'unplannedOutageCount',
      width: 140,
      sorter: (a: Statistics, b: Statistics) => a.unplannedOutageCount - b.unplannedOutageCount,
      sortOrder: sortedInfo.columnKey === 'unplannedOutageCount' && sortedInfo.order,
      render: (v: number) => (
        <span style={{ color: v > 2 ? '#ff4d4f' : '#1f1f1f' }}>{v} 次</span>
      )
    },
    {
      title: '平均辐射剂量',
      dataIndex: 'avgRadiationDose',
      key: 'avgRadiationDose',
      width: 140,
      sorter: (a: Statistics, b: Statistics) => a.avgRadiationDose - b.avgRadiationDose,
      sortOrder: sortedInfo.columnKey === 'avgRadiationDose' && sortedInfo.order,
      render: (v: number) => (
        <span style={{ color: v > RADIATION_LIMIT ? '#ff4d4f' : '#1f1f1f' }}>
          {formatNumber(v)} μSv/h
        </span>
      )
    },
    {
      title: '最大辐射剂量',
      dataIndex: 'maxRadiationDose',
      key: 'maxRadiationDose',
      width: 140,
      sorter: (a: Statistics, b: Statistics) => a.maxRadiationDose - b.maxRadiationDose,
      sortOrder: sortedInfo.columnKey === 'maxRadiationDose' && sortedInfo.order,
      render: (v: number) => (
        <span style={{ color: v > RADIATION_LIMIT ? '#ff4d4f' : '#1f1f1f' }}>
          {formatNumber(v)} μSv/h
        </span>
      )
    },
    {
      title: '设备可用率',
      dataIndex: 'equipmentAvailability',
      key: 'equipmentAvailability',
      width: 120,
      sorter: (a: Statistics, b: Statistics) => a.equipmentAvailability - b.equipmentAvailability,
      sortOrder: sortedInfo.columnKey === 'equipmentAvailability' && sortedInfo.order,
      render: (v: number) => `${formatNumber(v)}%`
    }
  ];

  const summaryRow = useMemo(() => {
    if (statistics.length === 0) return null;
    return {
      unitId: '合计',
      totalGeneration: statistics.reduce((sum, s) => sum + s.totalGeneration, 0),
      loadFactor: statistics.reduce((sum, s) => sum + s.loadFactor, 0) / statistics.length,
      unplannedOutageCount: statistics.reduce((sum, s) => sum + s.unplannedOutageCount, 0),
      avgRadiationDose: statistics.reduce((sum, s) => sum + s.avgRadiationDose, 0) / statistics.length,
      maxRadiationDose: Math.max(...statistics.map(s => s.maxRadiationDose)),
      equipmentAvailability: statistics.reduce((sum, s) => sum + s.equipmentAvailability, 0) / statistics.length
    };
  }, [statistics]);

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setSortedInfo(sorter);
  };

  return (
    <div style={{ padding: 0 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space wrap size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size="large" align="center">
                <Title level={4} style={{ margin: 0 }}>
                  <BarChartOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                  运行统计报表
                </Title>
              </Space>
              <Space wrap size="middle">
                <Space>
                  <Text type="secondary" style={{ fontSize: 13 }}>机组:</Text>
                  <Select
                    value={selectedUnitId}
                    onChange={setSelectedUnitId}
                    style={{ width: 150 }}
                    size="middle"
                  >
                    <Option value="all">全部机组</Option>
                    {units.map(unit => (
                      <Option key={unit.id} value={unit.id}>
                        {unit.unitNo}号机组
                      </Option>
                    ))}
                  </Select>
                </Space>
                <Space>
                  <Text type="secondary" style={{ fontSize: 13 }}>周期:</Text>
                  <Select
                    value={period}
                    onChange={setPeriod}
                    style={{ width: 100 }}
                    size="middle"
                  >
                    <Option value="daily">日</Option>
                    <Option value="weekly">周</Option>
                    <Option value="monthly">月</Option>
                  </Select>
                </Space>
                <Space>
                  <Text type="secondary" style={{ fontSize: 13 }}>日期:</Text>
                  <RangePicker
                    value={dateRange}
                    onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
                    size="middle"
                  />
                </Space>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleQuery}
                  loading={loading}
                >
                  查询统计
                </Button>
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={handleExportPDF}
                  loading={exporting}
                  danger
                >
                  导出PDF
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <OverviewCard
            title="总发电量"
            value={summary.totalGeneration}
            unit="MWh"
            icon={<ThunderboltOutlined />}
            color="#1677ff"
            comparison={{
              type: 'percent',
              value: summary.yoyGrowth,
              label: '同比'
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <OverviewCard
            title="负荷因子"
            value={summary.avgLoadFactor}
            unit="%"
            icon={<DashboardOutlined />}
            color={getLoadFactorColor(summary.avgLoadFactor)}
            comparison={{
              type: 'value',
              value: summary.avgLoadFactor,
              label: `目标值 ${TARGET_LOAD_FACTOR}%`,
              target: TARGET_LOAD_FACTOR
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <OverviewCard
            title="非计划停运次数"
            value={summary.totalOutageCount}
            unit="次"
            icon={<WarningOutlined />}
            color={summary.totalOutageCount > summary.historicalOutageAvg ? '#ff4d4f' : '#faad14'}
            comparison={{
              type: 'value',
              value: summary.totalOutageCount,
              label: `历史同期平均 ${summary.historicalOutageAvg}次`,
              target: summary.historicalOutageAvg
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <OverviewCard
            title="平均辐射剂量"
            value={summary.avgRadiation}
            unit="μSv/h"
            icon={<SafetyOutlined />}
            color={summary.avgRadiation > RADIATION_LIMIT ? '#ff4d4f' : '#52c41a'}
            comparison={{
              type: 'value',
              value: summary.avgRadiation,
              label: `限值 ${RADIATION_LIMIT}μSv/h`,
              target: RADIATION_LIMIT
            }}
            warning={summary.avgRadiation > RADIATION_LIMIT}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <OverviewCard
            title="设备可用率"
            value={summary.avgAvailability}
            unit="%"
            icon={<CheckCircleOutlined />}
            color={summary.avgAvailability >= 95 ? '#52c41a' : summary.avgAvailability >= 90 ? '#faad14' : '#ff4d4f'}
            comparison={{
              type: 'percent',
              value: summary.avgAvailability - 95,
              label: '目标95%'
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <OverviewCard
            title="最大辐射剂量"
            value={summary.maxRadiation}
            unit="μSv/h"
            icon={<WarningOutlined />}
            color={summary.maxRadiation > RADIATION_LIMIT ? '#ff4d4f' : '#52c41a'}
            warning={summary.maxRadiation > RADIATION_LIMIT}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: '#1677ff' }} />
                <span>各机组发电量对比</span>
              </Space>
            }
            bordered={false}
          >
            {statistics.length === 0 ? (
              <Empty description="请先查询数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
            ) : (
              <ReactECharts option={generationBarOption} style={{ height: '300px' }} notMerge />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <DashboardOutlined style={{ color: '#52c41a' }} />
                <span>负荷因子趋势</span>
              </Space>
            }
            bordered={false}
          >
            {statistics.length === 0 ? (
              <Empty description="请先查询数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
            ) : (
              <ReactECharts option={loadFactorTrendOption} style={{ height: '300px' }} notMerge />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                <span>停运原因分布</span>
              </Space>
            }
            bordered={false}
          >
            <ReactECharts option={outagePieOption} style={{ height: '300px' }} notMerge />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: '#1677ff' }} />
                <span>详细统计数据</span>
              </Space>
            }
            bordered={false}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                共 {statistics.length} 条记录 | 点击表头排序
              </Text>
            }
          >
            {statistics.length === 0 ? (
              <Empty description="请先查询数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '60px 0' }} />
            ) : (
              <Table
                size="small"
                dataSource={statistics}
                columns={tableColumns}
                rowKey="unitId"
                onChange={handleTableChange}
                pagination={false}
                scroll={{ x: 900 }}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                    <Table.Summary.Cell index={0}>
                      <Text strong>合计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong>{formatNumber(summaryRow?.totalGeneration || 0)} MWh</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Tag
                        color={(summaryRow?.loadFactor || 0) < 70 ? 'red' : (summaryRow?.loadFactor || 0) < 85 ? 'gold' : 'green'}
                        style={{ margin: 0 }}
                      >
                        {formatNumber(summaryRow?.loadFactor || 0)}%
                      </Tag>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <span style={{ color: (summaryRow?.unplannedOutageCount || 0) > 2 ? '#ff4d4f' : '#1f1f1f' }}>
                        {summaryRow?.unplannedOutageCount || 0} 次
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <span style={{ color: (summaryRow?.avgRadiationDose || 0) > RADIATION_LIMIT ? '#ff4d4f' : '#1f1f1f' }}>
                        {formatNumber(summaryRow?.avgRadiationDose || 0)} μSv/h
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>
                      <span style={{ color: (summaryRow?.maxRadiationDose || 0) > RADIATION_LIMIT ? '#ff4d4f' : '#1f1f1f' }}>
                        {formatNumber(summaryRow?.maxRadiationDose || 0)} μSv/h
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6}>
                      <Text strong>{formatNumber(summaryRow?.equipmentAvailability || 0)}%</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space size="large">
                <Space>
                  <ThunderboltOutlined style={{ color: '#1677ff' }} />
                  <span>发电量趋势分析</span>
                </Space>
                <Radio.Group value={trendType} onChange={(e) => setTrendType(e.target.value)} size="small">
                  <Radio.Button value="monthly">按月</Radio.Button>
                  <Radio.Button value="weekly">按周</Radio.Button>
                </Radio.Group>
              </Space>
            }
            bordered={false}
          >
            <ReactECharts option={generationTrendOption} style={{ height: '320px' }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <SafetyOutlined style={{ color: '#52c41a' }} />
                <span>设备状态统计</span>
              </Space>
            }
            bordered={false}
          >
            <ReactECharts option={equipmentStatusPieOption} style={{ height: '320px' }} notMerge />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <SafetyOutlined style={{ color: '#ff4d4f' }} />
                <span>辐射剂量趋势 (各监测点对比)</span>
              </Space>
            }
            bordered={false}
          >
            <ReactECharts option={radiationTrendOption} style={{ height: '320px' }} notMerge />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
                <span>报表说明</span>
              </Space>
            }
            bordered={false}
            size="small"
          >
            <Row gutter={[24, 8]}>
              <Col xs={24} sm={12} md={6}>
                <Space direction="vertical" size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>报告周期</Text>
                  <Text strong>
                    {dateRange[0].format('YYYY年MM月DD日')} - {dateRange[1].format('YYYY年MM月DD日')}
                  </Text>
                </Space>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Space direction="vertical" size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>生成时间</Text>
                  <Text strong>{dayjs().format('YYYY年MM月DD日 HH:mm:ss')}</Text>
                </Space>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Space direction="vertical" size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>统计范围</Text>
                  <Text strong>
                    {selectedUnitId === 'all' ? `全部 ${units.length} 台机组` : `${getUnitNo(selectedUnitId)}号机组`}
                  </Text>
                </Space>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Space direction="vertical" size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>统计周期</Text>
                  <Text strong>
                    {period === 'daily' ? '日报' : period === 'weekly' ? '周报' : '月报'}
                  </Text>
                </Space>
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Row>
              <Col span={24}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>数据来源说明</Text>
                  <Text style={{ fontSize: 13, lineHeight: 1.6 }}>
                    本报告数据来源于核电站运行监控系统，包括：反应堆实时运行数据、辐射监测系统数据、设备状态监测系统、发电计划与调度系统。
                    所有数据均经过自动化校验和人工复核，确保准确性和可靠性。负荷因子目标值为85%，辐射剂量限值为10μSv/h。
                  </Text>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatisticsPage;
