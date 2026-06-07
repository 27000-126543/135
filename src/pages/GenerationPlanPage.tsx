import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Button,
  Space,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Tabs,
  App,
  Popconfirm
} from 'antd';
import {
  ThunderboltOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  HistoryOutlined,
  EyeOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useAppStore } from '../store';
import { generationPlanApi, gridLoadForecastApi } from '../services/api';
import { GenerationPlan, HourlyPlan, GridLoadForecast } from '../../shared/types';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const MAX_RAMP_RATE = 50;

const statusMap: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  pending_approval: { color: 'warning', text: '待审批' },
  approved: { color: 'success', text: '已批准' },
  rejected: { color: 'error', text: '已拒绝' }
};

const GenerationPlanPage = () => {
  const { notification } = App.useApp();
  const {
    user,
    units,
    generationPlans,
    setGenerationPlans,
    addGenerationPlan,
    updateGenerationPlan
  } = useAppStore();

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [currentPlan, setCurrentPlan] = useState<GenerationPlan | null>(null);
  const [editingPlan, setEditingPlan] = useState<HourlyPlan[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [viewingPlan, setViewingPlan] = useState<GenerationPlan | null>(null);
  const [gridForecast, setGridForecast] = useState<GridLoadForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvalForm] = Form.useForm();
  const [adjustmentForm] = Form.useForm();

  useEffect(() => {
    if (units.length > 0 && !selectedUnitId) {
      setSelectedUnitId(units[0].id);
    }
    loadGridForecast();
  }, [units, selectedDate]);

  const loadGridForecast = async () => {
    try {
      const res = await gridLoadForecastApi.get(selectedDate);
      setGridForecast(res.data);
    } catch (error) {
      console.error('Failed to load grid forecast:', error);
    }
  };

  const selectedUnit = useMemo(() => 
    units.find(u => u.id === selectedUnitId),
    [units, selectedUnitId]
  );

  const validateRampRate = (plans: HourlyPlan[]): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    if (!selectedUnit) return { valid: false, issues: ['请选择机组'] };

    let prevPower = selectedUnit.currentPowerLevel;
    for (const plan of plans) {
      const rampRate = Math.abs(plan.targetPower - prevPower);
      if (rampRate > MAX_RAMP_RATE) {
        issues.push(`小时 ${plan.hour}: 功率变化速率 ${rampRate} MW/h 超过限制 ${MAX_RAMP_RATE} MW/h`);
      }
      if (plan.targetPower > selectedUnit.power) {
        issues.push(`小时 ${plan.hour}: 目标功率超过额定功率 ${selectedUnit.power} MW`);
      }
      if (plan.targetPower < selectedUnit.power * 0.3) {
        issues.push(`小时 ${plan.hour}: 目标功率低于最低运行功率 ${Math.round(selectedUnit.power * 0.3)} MW`);
      }
      prevPower = plan.targetPower;
    }
    return { valid: issues.length === 0, issues };
  };

  const calculateRampRates = (plans: HourlyPlan[]): HourlyPlan[] => {
    if (!selectedUnit) return plans;
    let prevPower = selectedUnit.currentPowerLevel;
    return plans.map(plan => {
      const rampRate = Math.abs(plan.targetPower - prevPower);
      prevPower = plan.targetPower;
      return { ...plan, rampRate };
    });
  };

  const handleGeneratePlan = async () => {
    if (!selectedUnitId) {
      message.warning('请先选择机组');
      return;
    }
    setLoading(true);
    try {
      const res = await generationPlanApi.generate(
        selectedUnitId,
        selectedDate,
        gridForecast?.hourlyLoad
      );
      setCurrentPlan(res.data);
      setEditingPlan([...res.data.hourlyPlan]);
      notification.success({
        message: '计划生成成功',
        description: `${selectedUnit?.unitNo} ${selectedDate} 发电计划已生成`
      });
    } catch (error: any) {
      notification.error({
        message: '计划生成失败',
        description: error.response?.data?.message || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!currentPlan) return;
    
    const validation = validateRampRate(currentPlan.hourlyPlan);
    if (!validation.valid) {
      Modal.error({
        title: '计划校验失败',
        content: (
          <ul>
            {validation.issues.map((issue, idx) => (
              <li key={idx} style={{ color: '#ff4d4f' }}>{issue}</li>
            ))}
          </ul>
        )
      });
      return;
    }

    setLoading(true);
    try {
      const planToSubmit = {
        ...currentPlan,
        status: 'pending_approval' as const
      };
      const res = await generationPlanApi.create(planToSubmit);
      addGenerationPlan(res.data);
      setCurrentPlan(res.data);
      notification.success({
        message: '提交成功',
        description: '发电计划已提交审批'
      });
    } catch (error: any) {
      notification.error({
        message: '提交失败',
        description: error.response?.data?.message || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (values: any) => {
    if (!currentPlan || !user) return;
    setLoading(true);
    try {
      await generationPlanApi.approve(
        currentPlan.id,
        user.id,
        'approved',
        values.comments
      );
      const updatedPlan = {
        ...currentPlan,
        status: 'approved' as const,
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
        notes: values.comments
      };
      updateGenerationPlan(updatedPlan);
      setCurrentPlan(updatedPlan);
      setApprovalModalVisible(false);
      approvalForm.resetFields();
      notification.success({
        message: '审批通过',
        description: '发电计划已批准'
      });
    } catch (error: any) {
      notification.error({
        message: '审批失败',
        description: error.response?.data?.message || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (values: any) => {
    if (!currentPlan || !user) return;
    setLoading(true);
    try {
      await generationPlanApi.approve(
        currentPlan.id,
        user.id,
        'rejected',
        values.comments
      );
      const updatedPlan = {
        ...currentPlan,
        status: 'rejected' as const,
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
        notes: values.comments
      };
      updateGenerationPlan(updatedPlan);
      setCurrentPlan(updatedPlan);
      setApprovalModalVisible(false);
      approvalForm.resetFields();
      notification.warning({
        message: '计划已拒绝',
        description: values.comments
      });
    } catch (error: any) {
      notification.error({
        message: '操作失败',
        description: error.response?.data?.message || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPlan = () => {
    if (!currentPlan || !user) return;
    notification.success({
      message: '计划已确认',
      description: '操作员已确认该发电计划'
    });
  };

  const handleRequestAdjustment = async (values: any) => {
    if (!currentPlan || !user) return;
    
    const validation = validateRampRate(editingPlan);
    if (!validation.valid) {
      Modal.error({
        title: '调整校验失败',
        content: (
          <ul>
            {validation.issues.map((issue, idx) => (
              <li key={idx} style={{ color: '#ff4d4f' }}>{issue}</li>
            ))}
          </ul>
        )
      });
      return;
    }

    setLoading(true);
    try {
      const newPlan = {
        ...currentPlan,
        hourlyPlan: calculateRampRates(editingPlan)
      };
      await generationPlanApi.requestAdjustment(
        currentPlan.id,
        user.id,
        newPlan,
        values.reason
      );
      setCurrentPlan(newPlan);
      setIsEditing(false);
      setAdjustmentModalVisible(false);
      adjustmentForm.resetFields();
      notification.success({
        message: '调整申请已提交',
        description: values.reason
      });
    } catch (error: any) {
      notification.error({
        message: '申请失败',
        description: error.response?.data?.message || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = () => {
    if (!currentPlan) return;
    setEditingPlan([...currentPlan.hourlyPlan]);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const validation = validateRampRate(editingPlan);
    if (!validation.valid) {
      Modal.error({
        title: '校验失败',
        content: (
          <ul>
            {validation.issues.map((issue, idx) => (
              <li key={idx} style={{ color: '#ff4d4f' }}>{issue}</li>
            ))}
          </ul>
        )
      });
      return;
    }
    if (currentPlan) {
      const updatedPlan = {
        ...currentPlan,
        hourlyPlan: calculateRampRates(editingPlan)
      };
      setCurrentPlan(updatedPlan);
    }
    setIsEditing(false);
    message.success('修改已保存');
  };

  const handleCancelEdit = () => {
    if (currentPlan) {
      setEditingPlan([...currentPlan.hourlyPlan]);
    }
    setIsEditing(false);
  };

  const handlePowerChange = (hour: number, value: number | null) => {
    if (value === null) return;
    setEditingPlan(prev => 
      prev.map(p => p.hour === hour ? { ...p, targetPower: value } : p)
    );
  };

  const handleViewDetail = (plan: GenerationPlan) => {
    setViewingPlan(plan);
    setDetailModalVisible(true);
  };

  const chartOption = useMemo(() => {
    const planData = currentPlan?.hourlyPlan || [];
    const xAxisData = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const planPower = planData.map(p => p.targetPower);
    const gridLoad = gridForecast?.hourlyLoad || [];

    return {
      title: {
        text: '24小时发电计划曲线',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['发电计划', '电网负荷预测'],
        top: 30
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 80,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        name: '时间'
      },
      yAxis: {
        type: 'value',
        name: '功率 (MW)',
        min: 0
      },
      series: [
        {
          name: '发电计划',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#1677ff'
          },
          lineStyle: {
            width: 3
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
          },
          data: planPower
        },
        {
          name: '电网负荷预测',
          type: 'line',
          smooth: true,
          symbol: 'diamond',
          symbolSize: 6,
          itemStyle: {
            color: '#fa8c16'
          },
          lineStyle: {
            width: 2,
            type: 'dashed'
          },
          data: gridLoad
        }
      ]
    };
  }, [currentPlan, gridForecast]);

  const detailChartOption = useMemo(() => {
    if (!viewingPlan) return {};
    const planData = viewingPlan.hourlyPlan;
    const xAxisData = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const planPower = planData.map(p => p.targetPower);

    return {
      title: {
        text: `${viewingPlan.date} 发电计划曲线`,
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 60,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        name: '时间'
      },
      yAxis: {
        type: 'value',
        name: '功率 (MW)',
        min: 0
      },
      series: [
        {
          name: '发电计划',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#1677ff'
          },
          lineStyle: {
            width: 3
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
          },
          data: planPower
        }
      ]
    };
  }, [viewingPlan]);

  const planColumns = [
    {
      title: '小时',
      dataIndex: 'hour',
      key: 'hour',
      width: 100,
      render: (hour: number) => `${hour}:00 - ${hour + 1}:00`
    },
    {
      title: '目标功率 (MW)',
      dataIndex: 'targetPower',
      key: 'targetPower',
      width: 200,
      render: (power: number, record: HourlyPlan) => {
        if (isEditing) {
          return (
            <InputNumber
              min={selectedUnit ? Math.round(selectedUnit.power * 0.3) : 0}
              max={selectedUnit?.power || 1000}
              value={editingPlan.find(p => p.hour === record.hour)?.targetPower}
              onChange={(value) => handlePowerChange(record.hour, value)}
              style={{ width: '100%' }}
            />
          );
        }
        return <span style={{ fontWeight: 500 }}>{power} MW</span>;
      }
    },
    {
      title: '功率变化速率 (MW/h)',
      dataIndex: 'rampRate',
      key: 'rampRate',
      width: 200,
      render: (rate: number, record: HourlyPlan) => {
        const currentRate = isEditing 
          ? Math.abs((editingPlan.find(p => p.hour === record.hour)?.targetPower || 0) - 
              (record.hour === 0 
                ? (selectedUnit?.currentPowerLevel || 0) 
                : (editingPlan.find(p => p.hour === record.hour - 1)?.targetPower || 0)))
          : rate;
        
        const isOverLimit = currentRate > MAX_RAMP_RATE;
        return (
          <Tag color={isOverLimit ? 'error' : currentRate > 0 ? 'blue' : 'default'}>
            {currentRate} MW/h
            {isOverLimit && ' (超限)'}
          </Tag>
        );
      }
    }
  ];

  const historyColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120
    },
    {
      title: '机组',
      dataIndex: 'unitId',
      key: 'unitId',
      width: 120,
      render: (unitId: string) => units.find(u => u.id === unitId)?.unitNo || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const info = statusMap[status];
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '审批人',
      dataIndex: 'approvedBy',
      key: 'approvedBy',
      width: 100,
      render: (id?: string) => id || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: GenerationPlan) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          查看详情
        </Button>
      )
    }
  ];

  const canApprove = user?.role === 'shift_supervisor' || user?.role === 'admin';
  const canEdit = currentPlan?.status === 'draft' || currentPlan?.status === 'rejected';

  return (
    <div>
      <Card>
        <Row gutter={16} align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Space>
              <ThunderboltOutlined style={{ fontSize: 20, color: '#1677ff' }} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>机组选择:</span>
              <Select
                value={selectedUnitId}
                onChange={setSelectedUnitId}
                style={{ width: 200 }}
                placeholder="选择机组"
              >
                {units.filter(u => u.status === 'operational').map(unit => (
                  <Option key={unit.id} value={unit.id}>
                    {unit.unitNo} - {unit.power} MW
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col>
            <Space>
              <span style={{ fontSize: 16, fontWeight: 600 }}>日期:</span>
              <DatePicker
                value={dayjs(selectedDate)}
                onChange={(date) => date && setSelectedDate(date.format('YYYY-MM-DD'))}
                style={{ width: 200 }}
              />
            </Space>
          </Col>
          <Col flex="auto">
            <Space style={{ float: 'right' }}>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleGeneratePlan}
                loading={loading}
              >
                生成计划
              </Button>
              {currentPlan && currentPlan.status === 'draft' && (
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={handleSubmitApproval}
                  loading={loading}
                >
                  提交审批
                </Button>
              )}
              {isEditing ? (
                <>
                  <Button type="primary" onClick={handleSaveEdit}>
                    保存修改
                  </Button>
                  <Button onClick={handleCancelEdit}>
                    取消
                  </Button>
                </>
              ) : (
                <>
                  {canEdit && currentPlan && (
                    <Button
                      icon={<EditOutlined />}
                      onClick={handleEditPlan}
                    >
                      调整计划
                    </Button>
                  )}
                  {canApprove && currentPlan?.status === 'pending_approval' && (
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => setApprovalModalVisible(true)}
                    >
                      审批
                    </Button>
                  )}
                  {currentPlan?.status === 'approved' && user?.role === 'operator' && (
                    <>
                      <Popconfirm
                        title="确认执行该计划？"
                        onConfirm={handleConfirmPlan}
                        okText="确认"
                        cancelText="取消"
                      >
                        <Button type="primary">
                          确认计划
                        </Button>
                      </Popconfirm>
                      <Button
                        danger
                        icon={<CloseCircleOutlined />}
                        onClick={() => setAdjustmentModalVisible(true)}
                      >
                        申请调整
                      </Button>
                    </>
                  )}
                </>
              )}
            </Space>
          </Col>
        </Row>

        {currentPlan && (
          <Row style={{ marginBottom: 16 }}>
            <Col span={24}>
              <Space size="large">
                <span style={{ fontSize: 14 }}>
                  <strong>机组:</strong> {units.find(u => u.id === currentPlan.unitId)?.unitNo}
                </span>
                <span style={{ fontSize: 14 }}>
                  <strong>日期:</strong> {currentPlan.date}
                </span>
                <span style={{ fontSize: 14 }}>
                  <strong>状态:</strong>{' '}
                  <Tag color={statusMap[currentPlan.status].color}>
                    {statusMap[currentPlan.status].text}
                  </Tag>
                </span>
                {currentPlan.notes && (
                  <span style={{ fontSize: 14 }}>
                    <strong>备注:</strong> {currentPlan.notes}
                  </span>
                )}
              </Space>
            </Col>
          </Row>
        )}

        <Tabs defaultActiveKey="1">
          <TabPane tab="计划详情" key="1">
            <Row gutter={16}>
              <Col span={24} style={{ marginBottom: 16 }}>
                <Card>
                  <ReactECharts
                    option={chartOption}
                    style={{ height: 400 }}
                    notMerge={true}
                  />
                </Card>
              </Col>
              <Col span={24}>
                <Card title="计划详情表">
                  <Table
                    columns={planColumns}
                    dataSource={isEditing ? editingPlan : currentPlan?.hourlyPlan || []}
                    rowKey="hour"
                    pagination={false}
                    scroll={{ y: 400 }}
                    size="middle"
                  />
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab={<span><HistoryOutlined /> 历史计划</span>} key="2">
            <Card>
              <Table
                columns={historyColumns}
                dataSource={generationPlans
                  .filter(p => p.unitId === selectedUnitId)
                  .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条记录`
                }}
              />
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="审批发电计划"
        open={approvalModalVisible}
        onCancel={() => {
          setApprovalModalVisible(false);
          approvalForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={approvalForm}
          layout="vertical"
          onFinish={handleApprove}
        >
          <Form.Item
            name="comments"
            label="审批意见"
            rules={[{ required: true, message: '请填写审批意见' }]}
          >
            <TextArea rows={4} placeholder="请填写审批意见..." />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setApprovalModalVisible(false);
                approvalForm.resetFields();
              }}>
                取消
              </Button>
              <Button
                danger
                onClick={() => {
                  approvalForm.validateFields().then(handleReject);
                }}
                loading={loading}
              >
                拒绝
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                通过
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="申请调整计划"
        open={adjustmentModalVisible}
        onCancel={() => {
          setAdjustmentModalVisible(false);
          adjustmentForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={adjustmentForm}
          layout="vertical"
          onFinish={handleRequestAdjustment}
        >
          <Form.Item
            name="reason"
            label="调整原因"
            rules={[{ required: true, message: '请填写调整原因' }]}
          >
            <TextArea rows={4} placeholder="请填写调整原因..." />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setAdjustmentModalVisible(false);
                adjustmentForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="计划详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {viewingPlan && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <p><strong>机组:</strong> {units.find(u => u.id === viewingPlan.unitId)?.unitNo}</p>
                <p><strong>日期:</strong> {viewingPlan.date}</p>
                <p>
                  <strong>状态:</strong>{' '}
                  <Tag color={statusMap[viewingPlan.status].color}>
                    {statusMap[viewingPlan.status].text}
                  </Tag>
                </p>
              </Col>
              <Col span={12}>
                <p><strong>创建时间:</strong> {dayjs(viewingPlan.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                {viewingPlan.approvedBy && (
                  <p><strong>审批人:</strong> {viewingPlan.approvedBy}</p>
                )}
                {viewingPlan.approvedAt && (
                  <p><strong>审批时间:</strong> {dayjs(viewingPlan.approvedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                )}
              </Col>
            </Row>
            {viewingPlan.notes && (
              <p style={{ marginBottom: 16 }}><strong>备注:</strong> {viewingPlan.notes}</p>
            )}
            <ReactECharts
              option={detailChartOption}
              style={{ height: 300 }}
              notMerge={true}
            />
            <Table
              columns={[
                {
                  title: '小时',
                  dataIndex: 'hour',
                  key: 'hour',
                  render: (hour: number) => `${hour}:00 - ${hour + 1}:00`
                },
                {
                  title: '目标功率 (MW)',
                  dataIndex: 'targetPower',
                  key: 'targetPower',
                  render: (power: number) => `${power} MW`
                },
                {
                  title: '功率变化速率 (MW/h)',
                  dataIndex: 'rampRate',
                  key: 'rampRate',
                  render: (rate: number) => (
                    <Tag color={rate > MAX_RAMP_RATE ? 'error' : 'blue'}>
                      {rate} MW/h
                    </Tag>
                  )
                }
              ]}
              dataSource={viewingPlan.hourlyPlan}
              rowKey="hour"
              pagination={false}
              size="small"
              style={{ marginTop: 16 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GenerationPlanPage;
