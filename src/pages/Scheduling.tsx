import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Card,
  Button,
  Tag,
  Avatar,
  Table,
  Modal,
  Form,
  Select,
  Input,
  Space,
  message,
  Progress,
  DatePicker,
  Divider,
  Alert,
  Row,
  Col,
  Popconfirm
} from 'antd';
import {
  SwapOutlined,
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useAppStore } from '../store';
import { shiftApi, shiftSwapRequestApi } from '../services/api';
import type { Shift, ShiftSwapRequest, Employee } from '../../shared/types';

const { Option } = Select;
const { TextArea } = Input;

const skillColorMap: Record<string, string> = {
  reactor_operator: 'blue',
  electrical: 'green',
  mechanical: 'orange',
  supervisor: 'purple',
  maintenance: 'default'
};

const skillNameMap: Record<string, string> = {
  reactor_operator: '反应堆操纵员',
  electrical: '电气',
  mechanical: '机械',
  supervisor: '主管',
  maintenance: '维修'
};

const shiftTypeMap: Record<string, { name: string; time: string; color: string }> = {
  morning: { name: '早班', time: '08:00-16:00', color: 'gold' },
  afternoon: { name: '中班', time: '16:00-00:00', color: 'blue' },
  night: { name: '夜班', time: '00:00-08:00', color: 'purple' }
};

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '在岗', color: 'success' },
  on_leave: { text: '休假', color: 'warning' },
  training: { text: '培训', color: 'processing' }
};

const swapStatusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'warning' },
  approved: { text: '已批准', color: 'success' },
  rejected: { text: '已拒绝', color: 'error' }
};

interface SwapFormValues {
  fromShiftId: string;
  toShiftId: string;
  requestedToEmployeeId?: string;
  reason: string;
}

const Scheduling: React.FC = () => {
  const {
    employees,
    shifts,
    shiftSwapRequests,
    user,
    setShifts,
    setShiftSwapRequests,
    addShiftSwapRequest,
    updateShiftSwapRequest
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('1');
  const [loading, setLoading] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Dayjs>(dayjs().startOf('week'));

  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapForm] = Form.useForm<SwapFormValues>();

  const [filterSkill, setFilterSkill] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<Employee['status'] | undefined>();

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const response = await shiftApi.getAll();
      setShifts(response.data);
    } catch (error) {
      message.error('获取排班数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSwapRequests = async () => {
    try {
      const response = await shiftSwapRequestApi.getAll();
      setShiftSwapRequests(response.data);
    } catch (error) {
      message.error('获取换班申请失败');
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchSwapRequests();
  }, []);

  const getWeekDates = (start: Dayjs): Dayjs[] => {
    const dates: Dayjs[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(start.add(i, 'day'));
    }
    return dates;
  };

  const getShiftsForDate = (date: Dayjs): Shift[] => {
    const dateStr = date.format('YYYY-MM-DD');
    return shifts.filter(s => s.date === dateStr);
  };

  const getEmployeeById = (id: string): Employee | undefined => {
    return employees.find(e => e.id === id);
  };

  const getShiftById = (id: string): Shift | undefined => {
    return shifts.find(s => s.id === id);
  };

  const handleGenerateShifts = async () => {
    try {
      const response = await shiftApi.generate(currentWeekStart.format('YYYY-MM-DD'));
      setShifts(response.data);
      message.success('排班生成成功');
    } catch (error) {
      message.error('排班生成失败');
    }
  };

  const prevWeek = () => {
    setCurrentWeekStart(currentWeekStart.subtract(1, 'week'));
  };

  const nextWeek = () => {
    setCurrentWeekStart(currentWeekStart.add(1, 'week'));
  };

  const isSupervisor = user?.role === 'shift_supervisor' || user?.role === 'admin';

  const validateSwapRequest = (fromShift: Shift, toShift: Shift): { valid: boolean; message: string } => {
    const fromDate = dayjs(fromShift.date);
    const toDate = dayjs(toShift.date);
    const hoursDiff = toDate.diff(fromDate, 'hour');

    if (hoursDiff < 24) {
      return { valid: false, message: '换班间隔必须不少于24小时' };
    }

    if (fromShift.shiftType === 'night' && toShift.shiftType === 'morning') {
      return { valid: false, message: '禁止夜班后直接上早班' };
    }

    if (user) {
      const employee = getEmployeeById(user.id);
      if (employee) {
        const shiftHours = 8;
        if (employee.currentHoursThisWeek + shiftHours > employee.maxHoursPerWeek) {
          return { valid: false, message: '换班后工时将超过每周上限' };
        }
      }
    }

    if (user) {
      const employee = getEmployeeById(user.id);
      if (employee) {
        const hasRequiredSkill = toShift.requiredSkills.some(skill =>
          employee.skills.includes(skill as any)
        );
        if (!hasRequiredSkill) {
          return { valid: false, message: '您不具备目标班次所需的技能' };
        }
      }
    }

    return { valid: true, message: '' };
  };

  const handleSwapSubmit = async () => {
    try {
      const values = await swapForm.validateFields();
      const fromShift = getShiftById(values.fromShiftId);
      const toShift = getShiftById(values.toShiftId);

      if (!fromShift || !toShift) {
        message.error('班次信息错误');
        return;
      }

      const validation = validateSwapRequest(fromShift, toShift);
      if (!validation.valid) {
        message.error(validation.message);
        return;
      }

      const newRequest: ShiftSwapRequest = {
        id: `swap_${Date.now()}`,
        employeeId: user?.id || '',
        fromShiftId: values.fromShiftId,
        toShiftId: values.toShiftId,
        requestedToEmployeeId: values.requestedToEmployeeId,
        reason: values.reason,
        status: 'pending'
      };

      await shiftSwapRequestApi.create(newRequest);
      addShiftSwapRequest(newRequest);
      message.success('换班申请已提交');
      setSwapModalVisible(false);
      swapForm.resetFields();
    } catch (error) {
      if (error !== 'Error: Submission failed') {
        message.error('提交失败');
      }
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      if (!user) {
        message.error('用户信息错误');
        return;
      }
      await shiftSwapRequestApi.approve(id, user.id, approved ? 'approved' : 'rejected');
      const existingRequest = shiftSwapRequests.find(r => r.id === id);
      if (existingRequest) {
        updateShiftSwapRequest({
          ...existingRequest,
          status: approved ? 'approved' : 'rejected',
          approvedBy: user.id
        });
      }
      message.success(approved ? '已批准' : '已拒绝');
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getHoursProgressColor = (current: number, max: number): string => {
    const ratio = current / max;
    if (ratio >= 1) return 'red';
    if (ratio >= 0.8) return 'gold';
    return 'green';
  };

  const filteredEmployees = employees.filter(emp => {
    const matchSkill = filterSkill ? emp.skills.includes(filterSkill as any) : true;
    const matchStatus = filterStatus ? emp.status === filterStatus : true;
    return matchSkill && matchStatus;
  });

  const mySwapRequests = shiftSwapRequests.filter(r => r.employeeId === user?.id);
  const pendingSwapRequests = shiftSwapRequests.filter(r => r.status === 'pending');

  const weekDates = getWeekDates(currentWeekStart);

  const employeeColumns: ColumnsType<Employee> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          {name}
        </Space>
      )
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      key: 'employeeNo',
      width: 120
    },
    {
      title: '技能列表',
      dataIndex: 'skills',
      key: 'skills',
      width: 300,
      render: (skills: string[]) => (
        <Space wrap>
          {skills.map(skill => (
            <Tag key={skill} color={skillColorMap[skill]}>
              {skillNameMap[skill]}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: '每周最大工时',
      dataIndex: 'maxHoursPerWeek',
      key: 'maxHoursPerWeek',
      width: 130,
      align: 'right',
      render: (value: number) => `${value} h`
    },
    {
      title: '本周已用工时',
      dataIndex: 'currentHoursThisWeek',
      key: 'currentHoursThisWeek',
      width: 130,
      align: 'right',
      render: (value: number) => `${value} h`
    },
    {
      title: '工时进度',
      key: 'progress',
      width: 200,
      render: (_, record) => {
        const percent = Math.min((record.currentHoursThisWeek / record.maxHoursPerWeek) * 100, 100);
        return (
          <Progress
            percent={Math.round(percent)}
            size="small"
            strokeColor={getHoursProgressColor(record.currentHoursThisWeek, record.maxHoursPerWeek)}
            format={() => `${record.currentHoursThisWeek}/${record.maxHoursPerWeek}h`}
          />
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Employee['status']) => {
        const { text, color } = statusMap[status];
        return <Tag color={color}>{text}</Tag>;
      }
    }
  ];

  const myRequestColumns: ColumnsType<ShiftSwapRequest> = [
    {
      title: '申请日期',
      key: 'requestDate',
      width: 120,
      render: (_, record) => {
        const shift = getShiftById(record.fromShiftId);
        return shift ? dayjs(shift.date).format('YYYY-MM-DD') : '-';
      }
    },
    {
      title: '原班次',
      key: 'fromShift',
      width: 150,
      render: (_, record) => {
        const shift = getShiftById(record.fromShiftId);
        if (!shift) return '-';
        const info = shiftTypeMap[shift.shiftType];
        return (
          <Space>
            <Tag color={info.color}>{info.name}</Tag>
            <span>{info.time}</span>
          </Space>
        );
      }
    },
    {
      title: '目标班次',
      key: 'toShift',
      width: 150,
      render: (_, record) => {
        const shift = getShiftById(record.toShiftId);
        if (!shift) return '-';
        const info = shiftTypeMap[shift.shiftType];
        return (
          <Space>
            <Tag color={info.color}>{info.name}</Tag>
            <span>{info.time}</span>
          </Space>
        );
      }
    },
    {
      title: '交换人员',
      key: 'swapWith',
      width: 120,
      render: (_, record) => {
        if (!record.requestedToEmployeeId) return '未指定';
        const emp = getEmployeeById(record.requestedToEmployeeId);
        return emp?.name || '-';
      }
    },
    {
      title: '申请原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ShiftSwapRequest['status']) => {
        const { text, color } = swapStatusMap[status];
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        record.status === 'pending' ? (
          <Button
            type="link"
            danger
            onClick={() => message.info('撤销功能待实现')}
          >
            撤销
          </Button>
        ) : null
      )
    }
  ];

  const pendingRequestColumns: ColumnsType<ShiftSwapRequest> = [
    {
      title: '申请人',
      key: 'applicant',
      width: 120,
      render: (_, record) => {
        const emp = getEmployeeById(record.employeeId);
        return emp?.name || '-';
      }
    },
    {
      title: '原班次',
      key: 'fromShift',
      width: 180,
      render: (_, record) => {
        const shift = getShiftById(record.fromShiftId);
        if (!shift) return '-';
        const info = shiftTypeMap[shift.shiftType];
        return (
          <Space direction="vertical" size={0}>
            <span>{dayjs(shift.date).format('YYYY-MM-DD')}</span>
            <Space>
              <Tag color={info.color}>{info.name}</Tag>
              <span>{info.time}</span>
            </Space>
          </Space>
        );
      }
    },
    {
      title: '目标班次',
      key: 'toShift',
      width: 180,
      render: (_, record) => {
        const shift = getShiftById(record.toShiftId);
        if (!shift) return '-';
        const info = shiftTypeMap[shift.shiftType];
        return (
          <Space direction="vertical" size={0}>
            <span>{dayjs(shift.date).format('YYYY-MM-DD')}</span>
            <Space>
              <Tag color={info.color}>{info.name}</Tag>
              <span>{info.time}</span>
            </Space>
          </Space>
        );
      }
    },
    {
      title: '交换人员',
      key: 'swapWith',
      width: 120,
      render: (_, record) => {
        if (!record.requestedToEmployeeId) return '未指定';
        const emp = getEmployeeById(record.requestedToEmployeeId);
        return emp?.name || '-';
      }
    },
    {
      title: '申请原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record.id, true)}
          >
            批准
          </Button>
          <Popconfirm
            title="拒绝换班"
            description="确定要拒绝该换班申请吗？"
            onConfirm={() => handleApprove(record.id, false)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
            >
              拒绝
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const renderShiftCard = (shift: Shift) => {
    const shiftInfo = shiftTypeMap[shift.shiftType];
    const shiftEmployees = shift.employeeIds.map(id => getEmployeeById(id)).filter(Boolean) as Employee[];

    return (
      <Card
        key={shift.id}
        size="small"
        style={{ marginBottom: 8 }}
        title={
          <Space>
            <Tag color={shiftInfo.color}>{shiftInfo.name}</Tag>
            <span style={{ fontSize: 12, color: '#666' }}>{shiftInfo.time}</span>
          </Space>
        }
      >
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>所需技能：</div>
          <Space wrap>
            {shift.requiredSkills.map(skill => (
              <Tag key={skill} color={skillColorMap[skill]}>
                {skillNameMap[skill]}
              </Tag>
            ))}
          </Space>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            排班人员 ({shiftEmployees.length}/4)：
          </div>
          <Space wrap>
            {shiftEmployees.map(emp => (
              <Space key={emp.id} size={4} style={{ marginRight: 8 }}>
                <Avatar size={24} icon={<UserOutlined />} />
                <span style={{ fontSize: 13 }}>{emp.name}</span>
              </Space>
            ))}
            {shiftEmployees.length === 0 && (
              <span style={{ color: '#999', fontSize: 12 }}>暂未排班</span>
            )}
          </Space>
        </div>
      </Card>
    );
  };

  const renderScheduleTab = () => (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={prevWeek}>上一周</Button>
          <DatePicker
            value={currentWeekStart}
            onChange={(date) => date && setCurrentWeekStart(date.startOf('week'))}
            style={{ width: 200 }}
          />
          <Button icon={<RightOutlined />} onClick={nextWeek}>下一周</Button>
          <span style={{ fontWeight: 500, marginLeft: 16 }}>
            {currentWeekStart.format('YYYY-MM-DD')} ~ {currentWeekStart.add(6, 'day').format('YYYY-MM-DD')}
          </span>
        </Space>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={handleGenerateShifts}
        >
          生成本周排班
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {weekDates.map((date, index) => {
          const dayShifts = getShiftsForDate(date);
          const isToday = date.isSame(dayjs(), 'day');
          const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

          return (
            <Col key={index} xs={24} sm={12} md={8} lg={6} xl={3}>
              <Card
                size="small"
                style={{
                  marginBottom: 16,
                  borderColor: isToday ? '#1677ff' : undefined,
                  background: isToday ? '#e6f4ff' : undefined
                }}
                title={
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {dayNames[date.day()]}
                    </div>
                    <div style={{ fontSize: 12, color: isToday ? '#1677ff' : '#666' }}>
                      {date.format('MM-DD')}
                    </div>
                  </div>
                }
              >
                <div style={{ minHeight: 300 }}>
                  {dayShifts.length > 0 ? (
                    dayShifts.map(renderShiftCard)
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                      暂无排班
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            排班规则说明
          </Space>
        }
        type="inner"
      >
        <Row gutter={24}>
          <Col xs={24} sm={12} md={6}>
            <Alert
              type="info"
              showIcon
              message="人员配置"
              description="每班至少4人，必须包含反应堆操纵员、电气、机械各至少1人"
              style={{ height: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Alert
              type="warning"
              showIcon
              message="休息间隔"
              description="夜班后必须休息24小时才能上白班"
              style={{ height: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Alert
              type="error"
              showIcon
              message="工时限制"
              description="每周工时不超过48小时"
              style={{ height: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Alert
              type="success"
              showIcon
              message="技能要求"
              description="必须具备所需技能才能排班"
              style={{ height: '100%' }}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );

  const renderSwapTab = () => (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>我的换班申请</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setSwapModalVisible(true)}
        >
          申请换班
        </Button>
      </div>

      <Table
        columns={myRequestColumns}
        dataSource={mySwapRequests}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ marginBottom: 32 }}
      />

      {isSupervisor && (
        <>
          <Divider orientation="left">待审批申请</Divider>
          <Table
            columns={pendingRequestColumns}
            dataSource={pendingSwapRequests}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </>
      )}

      <Modal
        title="申请换班"
        open={swapModalVisible}
        onOk={handleSwapSubmit}
        onCancel={() => setSwapModalVisible(false)}
        okText="提交申请"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form
          form={swapForm}
          layout="vertical"
        >
          <Form.Item
            name="fromShiftId"
            label="原班次"
            rules={[{ required: true, message: '请选择原班次' }]}
          >
            <Select placeholder="请选择您要换出的班次">
              {shifts
                .filter(s => s.employeeIds.includes(user?.id || ''))
                .map(shift => {
                  const info = shiftTypeMap[shift.shiftType];
                  return (
                    <Option key={shift.id} value={shift.id}>
                      {dayjs(shift.date).format('YYYY-MM-DD')} {info.name} ({info.time})
                    </Option>
                  );
                })}
            </Select>
          </Form.Item>

          <Form.Item
            name="toShiftId"
            label="目标班次"
            rules={[{ required: true, message: '请选择目标班次' }]}
          >
            <Select placeholder="请选择您要换入的班次">
              {shifts
                .filter(s => !s.employeeIds.includes(user?.id || ''))
                .map(shift => {
                  const info = shiftTypeMap[shift.shiftType];
                  return (
                    <Option key={shift.id} value={shift.id}>
                      {dayjs(shift.date).format('YYYY-MM-DD')} {info.name} ({info.time})
                    </Option>
                  );
                })}
            </Select>
          </Form.Item>

          <Form.Item
            name="requestedToEmployeeId"
            label="交换人员（可选）"
          >
            <Select placeholder="选择希望交换的人员" allowClear>
              {employees
                .filter(e => e.id !== user?.id && e.status === 'active')
                .map(emp => (
                  <Option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="申请原因"
            rules={[
              { required: true, message: '请填写申请原因' },
              { min: 5, message: '原因至少5个字' }
            ]}
          >
            <TextArea
              rows={4}
              placeholder="请详细说明换班原因..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Alert
            type="warning"
            showIcon
            message="换班规则"
            description="换班间隔不少于24小时，禁止夜班后直接早班，不得超过每周工时上限，必须具备目标班次所需技能。"
          />
        </Form>
      </Modal>
    </div>
  );

  const renderEmployeeTab = () => (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="middle">
          <Select
            placeholder="按技能筛选"
            value={filterSkill}
            onChange={setFilterSkill}
            style={{ width: 180 }}
            allowClear
          >
            <Option value="reactor_operator">反应堆操纵员</Option>
            <Option value="electrical">电气</Option>
            <Option value="mechanical">机械</Option>
            <Option value="supervisor">主管</Option>
            <Option value="maintenance">维修</Option>
          </Select>
          <Select
            placeholder="按状态筛选"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="active">在岗</Option>
            <Option value="on_leave">休假</Option>
            <Option value="training">培训</Option>
          </Select>
        </Space>
        <span style={{ color: '#666' }}>共 {filteredEmployees.length} 人</span>
      </div>

      <Table
        columns={employeeColumns}
        dataSource={filteredEmployees}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );

  return (
    <div style={{ padding: 8 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: '1',
            label: (
              <Space>
                <SwapOutlined />
                排班表
              </Space>
            ),
            children: renderScheduleTab()
          },
          {
            key: '2',
            label: (
              <Space>
                <SwapOutlined />
                换班申请
              </Space>
            ),
            children: renderSwapTab()
          },
          {
            key: '3',
            label: (
              <Space>
                <UserOutlined />
                员工信息
              </Space>
            ),
            children: renderEmployeeTab()
          }
        ]}
      />
    </div>
  );
};

export default Scheduling;
