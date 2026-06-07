import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store';
import { unitApi } from '../services/api';
import type { Unit } from '../../shared/types';

const { Option } = Select;

const statusMap: Record<Unit['status'], { text: string; color: string }> = {
  operational: { text: '运行中', color: 'success' },
  maintenance: { text: '维护中', color: 'warning' },
  shutdown: { text: '停机', color: 'error' },
  refueling: { text: '换料中', color: 'processing' },
};

const reactorTypeMap: Record<Unit['reactorType'], string> = {
  PWR: '压水堆(PWR)',
  BWR: '沸水堆(BWR)',
  CANDU: '重水堆(CANDU)',
  FBR: '快中子增殖堆(FBR)',
};

interface FormValues {
  unitNo: string;
  power: number;
  reactorType: Unit['reactorType'];
  currentPowerLevel: number;
  fuelRodLife: number;
  status: Unit['status'];
  operatingHours: number;
  lastMaintenanceDate: dayjs.Dayjs;
  nextMaintenanceDate: dayjs.Dayjs;
}

const UnitManagement: React.FC = () => {
  const { units, setUnits } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [searchUnitNo, setSearchUnitNo] = useState('');
  const [searchStatus, setSearchStatus] = useState<Unit['status'] | undefined>();

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const response = await unitApi.getAll();
      setUnits(response.data);
    } catch (error) {
      message.error('获取机组列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleAdd = () => {
    setEditingUnit(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Unit) => {
    setEditingUnit(record);
    form.setFieldsValue({
      ...record,
      lastMaintenanceDate: dayjs(record.lastMaintenanceDate),
      nextMaintenanceDate: dayjs(record.nextMaintenanceDate),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await unitApi.delete(id);
      message.success('删除成功');
      fetchUnits();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const unitData: Omit<Unit, 'id'> = {
        ...values,
        lastMaintenanceDate: values.lastMaintenanceDate.format('YYYY-MM-DD'),
        nextMaintenanceDate: values.nextMaintenanceDate.format('YYYY-MM-DD'),
      };

      if (editingUnit) {
        await unitApi.update(editingUnit.id, { ...unitData, id: editingUnit.id });
        message.success('更新成功');
      } else {
        const newUnit: Unit = {
          ...unitData,
          id: `unit_${Date.now()}`,
        };
        await unitApi.create(newUnit);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchUnits();
    } catch (error) {
      if (error !== 'Error: Submission failed') {
        message.error(editingUnit ? '更新失败' : '创建失败');
      }
    }
  };

  const filteredUnits = units.filter((unit) => {
    const matchUnitNo = unit.unitNo.toLowerCase().includes(searchUnitNo.toLowerCase());
    const matchStatus = searchStatus ? unit.status === searchStatus : true;
    return matchUnitNo && matchStatus;
  });

  const columns: ColumnsType<Unit> = [
    {
      title: '机组编号',
      dataIndex: 'unitNo',
      key: 'unitNo',
      width: 120,
    },
    {
      title: '额定功率(MW)',
      dataIndex: 'power',
      key: 'power',
      width: 130,
      align: 'right',
    },
    {
      title: '堆型',
      dataIndex: 'reactorType',
      key: 'reactorType',
      width: 180,
      render: (type: Unit['reactorType']) => reactorTypeMap[type],
    },
    {
      title: '当前功率水平(MW)',
      dataIndex: 'currentPowerLevel',
      key: 'currentPowerLevel',
      width: 160,
      align: 'right',
    },
    {
      title: '燃料棒寿期(%)',
      dataIndex: 'fuelRodLife',
      key: 'fuelRodLife',
      width: 130,
      align: 'right',
      render: (value: number) => `${value}%`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Unit['status']) => {
        const { text, color } = statusMap[status];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '累计运行小时',
      dataIndex: 'operatingHours',
      key: 'operatingHours',
      width: 130,
      align: 'right',
      render: (value: number) => `${value} h`,
    },
    {
      title: '上次维护日期',
      dataIndex: 'lastMaintenanceDate',
      key: 'lastMaintenanceDate',
      width: 130,
    },
    {
      title: '下次维护日期',
      dataIndex: 'nextMaintenanceDate',
      key: 'nextMaintenanceDate',
      width: 130,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除该机组吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="middle">
          <Input
            placeholder="搜索机组编号"
            prefix={<SearchOutlined />}
            value={searchUnitNo}
            onChange={(e) => setSearchUnitNo(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="按状态筛选"
            value={searchStatus}
            onChange={(value) => setSearchStatus(value)}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="operational">运行中</Option>
            <Option value="maintenance">维护中</Option>
            <Option value="shutdown">停机</Option>
            <Option value="refueling">换料中</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增机组
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={filteredUnits}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1300 }}
      />

      <Modal
        title={editingUnit ? '编辑机组' : '新增机组'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确认"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            reactorType: 'PWR',
            status: 'operational',
          }}
        >
          <Form.Item
            name="unitNo"
            label="机组编号"
            rules={[{ required: true, message: '请输入机组编号' }]}
          >
            <Input placeholder="请输入机组编号" />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="power"
              label="额定功率(MW)"
              rules={[{ required: true, message: '请输入额定功率' }]}
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                placeholder="请输入"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="reactorType"
              label="堆型"
              rules={[{ required: true, message: '请选择堆型' }]}
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择">
                <Option value="PWR">压水堆(PWR)</Option>
                <Option value="BWR">沸水堆(BWR)</Option>
                <Option value="CANDU">重水堆(CANDU)</Option>
                <Option value="FBR">快中子增殖堆(FBR)</Option>
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="currentPowerLevel"
              label="当前功率水平(MW)"
              rules={[{ required: true, message: '请输入当前功率水平' }]}
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                placeholder="请输入"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="fuelRodLife"
              label="燃料棒寿期(%)"
              rules={[
                { required: true, message: '请输入燃料棒寿期' },
                { type: 'number', min: 0, max: 100, message: '请输入0-100之间的数值' },
              ]}
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                max={100}
                placeholder="0-100"
                style={{ width: '100%' }}
                addonAfter="%"
              />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="status"
              label="状态"
              rules={[{ required: true, message: '请选择状态' }]}
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择">
                <Option value="operational">运行中</Option>
                <Option value="maintenance">维护中</Option>
                <Option value="shutdown">停机</Option>
                <Option value="refueling">换料中</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="operatingHours"
              label="累计运行小时"
              rules={[{ required: true, message: '请输入累计运行小时' }]}
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                placeholder="请输入"
                style={{ width: '100%' }}
                addonAfter="h"
              />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="lastMaintenanceDate"
              label="上次维护日期"
              rules={[{ required: true, message: '请选择上次维护日期' }]}
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item
              name="nextMaintenanceDate"
              label="下次维护日期"
              rules={[{ required: true, message: '请选择下次维护日期' }]}
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default UnitManagement;
