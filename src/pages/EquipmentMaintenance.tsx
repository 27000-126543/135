import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  message,
  Card,
  Row,
  Col,
  InputNumber,
  Statistic
} from 'antd';
import {
  ToolOutlined,
  FileTextOutlined,
  StockOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  WarningOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppStore } from '../store';
import {
  equipmentApi,
  maintenanceOrderApi,
  inventoryApi
} from '../services/api';
import type {
  Equipment,
  MaintenanceOrder,
  Inventory,
  MaintenancePart
} from '../../shared/types';

const { Option } = Select;
const { TabPane } = Tabs;

const categoryMap: Record<Equipment['category'], string> = {
  reactor: '反应堆',
  turbine: '汽轮机',
  generator: '发电机',
  coolant: '冷却剂',
  electrical: '电气',
  other: '其他'
};

const criticalityColorMap: Record<number, string> = {
  1: 'red',
  2: 'orange',
  3: 'gold'
};

const statusMap: Record<Equipment['status'], { text: string; color: string }> = {
  normal: { text: '正常', color: 'success' },
  warning: { text: '预警', color: 'warning' },
  maintenance_required: { text: '需维护', color: 'orange' },
  failed: { text: '故障', color: 'error' }
};

const priorityMap: Record<MaintenanceOrder['priority'], { text: string; color: string }> = {
  low: { text: '低', color: 'blue' },
  medium: { text: '中', color: 'gold' },
  high: { text: '高', color: 'orange' },
  critical: { text: '紧急', color: 'red' }
};

const orderStatusMap: Record<MaintenanceOrder['status'], { text: string; color: string }> = {
  pending: { text: '待处理', color: 'default' },
  in_progress: { text: '进行中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'error' }
};

const getInventoryStatus = (item: Inventory) => {
  const ratio = item.quantity / item.minStock;
  if (ratio <= 0.5) return { text: '紧缺', color: 'red' };
  if (ratio < 1) return { text: '不足', color: 'gold' };
  return { text: '充足', color: 'green' };
};

const isMaintenanceDueSoon = (nextMaintenance: string) => {
  const nextDate = dayjs(nextMaintenance);
  const now = dayjs();
  return nextDate.diff(now, 'day') <= 7;
};

const EquipmentMaintenance: React.FC = () => {
  const {
    units,
    equipment,
    maintenanceOrders,
    inventory,
    lowStockItems,
    setEquipment,
    setMaintenanceOrders,
    addMaintenanceOrder,
    updateMaintenanceOrder,
    setInventory,
    setLowStockItems,
    updateInventory
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('equipment');
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceOrder | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [form] = Form.useForm();

  const [filterUnitId, setFilterUnitId] = useState<string | undefined>();
  const [filterCategory, setFilterCategory] = useState<Equipment['category'] | undefined>();
  const [filterStatus, setFilterStatus] = useState<Equipment['status'] | undefined>();

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [equipmentRes, ordersRes, inventoryRes, lowStockRes] = await Promise.all([
        equipmentApi.getAll(),
        maintenanceOrderApi.getAll(),
        inventoryApi.getAll(),
        inventoryApi.getLowStock()
      ]);
      setEquipment(equipmentRes.data);
      setMaintenanceOrders(ordersRes.data);
      setInventory(inventoryRes.data);
      setLowStockItems(lowStockRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleGenerateOrders = async () => {
    try {
      const response = await maintenanceOrderApi.generate();
      response.data.forEach(order => addMaintenanceOrder(order));
      message.success(`成功生成 ${response.data.length} 条维保工单`);
      fetchAllData();
    } catch (error) {
      message.error('生成维保工单失败');
    }
  };

  const handleStartMaintenance = async (order: MaintenanceOrder) => {
    if (order.status !== 'pending') {
      message.error('只有待处理的工单才能开始维修');
      return;
    }
    try {
      await maintenanceOrderApi.updateStatus(order.id, 'in_progress');
      updateMaintenanceOrder({ ...order, status: 'in_progress', startedAt: new Date().toISOString() });
      message.success('已开始维修');
    } catch (error) {
      message.error('更新状态失败');
    }
  };

  const handleCompleteMaintenance = async (order: MaintenanceOrder) => {
    if (order.status !== 'in_progress') {
      message.error('只有进行中的工单才能完成维修');
      return;
    }
    try {
      await maintenanceOrderApi.updateStatus(order.id, 'completed');
      updateMaintenanceOrder({ ...order, status: 'completed', completedAt: new Date().toISOString() });
      message.success('已完成维修');
    } catch (error) {
      message.error('更新状态失败');
    }
  };

  const handleViewDetails = (order: MaintenanceOrder) => {
    setSelectedOrder(order);
    setDetailModalVisible(true);
  };

  const handleRestock = (item: Inventory) => {
    setSelectedInventory(item);
    form.resetFields();
    setRestockModalVisible(true);
  };

  const handleRestockSubmit = async () => {
    if (!selectedInventory) return;
    try {
      const values = await form.validateFields();
      const response = await inventoryApi.restock(selectedInventory.id, values.quantity);
      updateInventory(response.data);
      const lowStockRes = await inventoryApi.getLowStock();
      setLowStockItems(lowStockRes.data);
      message.success('库存补充成功');
      setRestockModalVisible(false);
    } catch (error) {
      message.error('库存补充失败');
    }
  };

  const getEquipmentName = (equipmentId: string) => {
    const eq = equipment.find(e => e.id === equipmentId);
    return eq ? eq.name : '-';
  };

  const getUnitNo = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    return unit ? unit.unitNo : '-';
  };

  const filteredEquipment = equipment.filter((eq) => {
    const matchUnit = filterUnitId ? eq.unitId === filterUnitId : true;
    const matchCategory = filterCategory ? eq.category === filterCategory : true;
    const matchStatus = filterStatus ? eq.status === filterStatus : true;
    return matchUnit && matchCategory && matchStatus;
  });

  const calculateEstimatedHours = (order: MaintenanceOrder) => {
    if (order.startedAt && order.completedAt) {
      return dayjs(order.completedAt).diff(dayjs(order.startedAt), 'hour', true).toFixed(1);
    }
    return '-';
  };

  const equipmentColumns: ColumnsType<Equipment> = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string, record) => (
        <span style={{ fontWeight: isMaintenanceDueSoon(record.nextMaintenance) ? 'bold' : 'normal' }}>
          {text}
        </span>
      )
    },
    {
      title: '所属机组',
      dataIndex: 'unitId',
      key: 'unitId',
      width: 100,
      render: (unitId: string) => getUnitNo(unitId)
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: Equipment['category']) => categoryMap[category]
    },
    {
      title: '关键级别',
      dataIndex: 'criticalityLevel',
      key: 'criticalityLevel',
      width: 100,
      align: 'center',
      render: (level: number) => (
        <Tag color={criticalityColorMap[level]}>
          {level}
        </Tag>
      )
    },
    {
      title: '累计运行小时',
      dataIndex: 'operatingHours',
      key: 'operatingHours',
      width: 130,
      align: 'right',
      render: (value: number) => `${value} h`
    },
    {
      title: '上次维护日期',
      dataIndex: 'lastMaintenance',
      key: 'lastMaintenance',
      width: 120
    },
    {
      title: '下次维护日期',
      dataIndex: 'nextMaintenance',
      key: 'nextMaintenance',
      width: 120,
      render: (date: string) => (
        <span style={{ color: isMaintenanceDueSoon(date) ? '#ff4d4f' : 'inherit' }}>
          {date}
          {isMaintenanceDueSoon(date) && <WarningOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Equipment['status']) => {
        const { text, color } = statusMap[status];
        return <Tag color={color}>{text}</Tag>;
      }
    }
  ];

  const orderColumns: ColumnsType<MaintenanceOrder> = [
    {
      title: '工单编号',
      dataIndex: 'id',
      key: 'id',
      width: 150
    },
    {
      title: '设备名称',
      dataIndex: 'equipmentId',
      key: 'equipmentId',
      width: 150,
      render: (equipmentId: string) => getEquipmentName(equipmentId)
    },
    {
      title: '所属机组',
      dataIndex: 'unitId',
      key: 'unitId',
      width: 100,
      render: (unitId: string) => getUnitNo(unitId)
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      align: 'center',
      render: (priority: MaintenanceOrder['priority']) => {
        const { text, color } = priorityMap[priority];
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '分配班组',
      dataIndex: 'assignedTeam',
      key: 'assignedTeam',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: MaintenanceOrder['status']) => {
        const { text, color } = orderStatusMap[status];
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '预计工时',
      key: 'estimatedHours',
      width: 100,
      align: 'right',
      render: (_, record) => `${calculateEstimatedHours(record)} h`
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleStartMaintenance(record)}
            disabled={record.status !== 'pending'}
          >
            开始维修
          </Button>
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => handleCompleteMaintenance(record)}
            disabled={record.status !== 'in_progress'}
          >
            完成维修
          </Button>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            查看详情
          </Button>
        </Space>
      )
    }
  ];

  const inventoryColumns: ColumnsType<Inventory> = [
    {
      title: '备件名称',
      dataIndex: 'partName',
      key: 'partName',
      width: 150
    },
    {
      title: '备件编号',
      dataIndex: 'partNo',
      key: 'partNo',
      width: 120
    },
    {
      title: '当前库存',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right'
    },
    {
      title: '最低库存',
      dataIndex: 'minStock',
      key: 'minStock',
      width: 100,
      align: 'right'
    },
    {
      title: '最高库存',
      dataIndex: 'maxStock',
      key: 'maxStock',
      width: 100,
      align: 'right'
    },
    {
      title: '库位',
      dataIndex: 'location',
      key: 'location',
      width: 100
    },
    {
      title: '库存状态',
      key: 'inventoryStatus',
      width: 100,
      render: (_, record) => {
        const { text, color } = getInventoryStatus(record);
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '最后更新时间',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={() => handleRestock(record)}
        >
          补充库存
        </Button>
      )
    }
  ];

  const partsColumns: ColumnsType<MaintenancePart> = [
    {
      title: '备件名称',
      dataIndex: 'partName',
      key: 'partName'
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right'
    },
    {
      title: '单价(元)',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      render: (value: number) => value.toFixed(2)
    },
    {
      title: '总价(元)',
      key: 'totalPrice',
      align: 'right',
      render: (_, record) => (record.quantity * record.unitPrice).toFixed(2)
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="设备总数"
              value={equipment.length}
              prefix={<ToolOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="待处理工单"
              value={maintenanceOrders.filter(o => o.status === 'pending').length}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="进行中工单"
              value={maintenanceOrders.filter(o => o.status === 'in_progress').length}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="低库存备件"
              value={lowStockItems.length}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: lowStockItems.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Col>
        </Row>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        <TabPane
          tab={
            <span>
              <ToolOutlined />
              设备列表
            </span>
          }
          key="equipment"
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size="middle">
              <Select
                placeholder="按机组筛选"
                value={filterUnitId}
                onChange={(value) => setFilterUnitId(value)}
                style={{ width: 150 }}
                allowClear
              >
                {units.map(unit => (
                  <Option key={unit.id} value={unit.id}>{unit.unitNo}</Option>
                ))}
              </Select>
              <Select
                placeholder="按类别筛选"
                value={filterCategory}
                onChange={(value) => setFilterCategory(value)}
                style={{ width: 150 }}
                allowClear
              >
                <Option value="reactor">反应堆</Option>
                <Option value="turbine">汽轮机</Option>
                <Option value="generator">发电机</Option>
                <Option value="coolant">冷却剂</Option>
                <Option value="electrical">电气</Option>
                <Option value="other">其他</Option>
              </Select>
              <Select
                placeholder="按状态筛选"
                value={filterStatus}
                onChange={(value) => setFilterStatus(value)}
                style={{ width: 150 }}
                allowClear
              >
                <Option value="normal">正常</Option>
                <Option value="warning">预警</Option>
                <Option value="maintenance_required">需维护</Option>
                <Option value="failed">故障</Option>
              </Select>
            </Space>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={handleGenerateOrders}
            >
              生成维保工单
            </Button>
          </div>

          <Table
            columns={equipmentColumns}
            dataSource={filteredEquipment}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1000 }}
            rowClassName={(record) =>
              isMaintenanceDueSoon(record.nextMaintenance) ? 'maintenance-due-soon' : ''
            }
          />
        </TabPane>

        <TabPane
          tab={
            <span>
              <FileTextOutlined />
              维保工单
            </span>
          }
          key="maintenance"
        >
          <Table
            columns={orderColumns}
            dataSource={maintenanceOrders}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1200 }}
          />
        </TabPane>

        <TabPane
          tab={
            <span>
              <StockOutlined />
              库存管理
            </span>
          }
          key="inventory"
        >
          {lowStockItems.length > 0 && (
            <Card
              title={
                <span>
                  <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  低库存预警
                </span>
              }
              style={{ marginBottom: 16, backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}
            >
              <Row gutter={[16, 16]}>
                {lowStockItems.map(item => (
                  <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                    <Card size="small" style={{ backgroundColor: '#fff', borderColor: '#ffa940' }}>
                      <div style={{ fontWeight: 'bold' }}>{item.partName}</div>
                      <div style={{ color: '#666', fontSize: 12 }}>编号: {item.partNo}</div>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                          当前: {item.quantity}
                        </span>
                        <span style={{ color: '#999', marginLeft: 8 }}>
                          最低: {item.minStock}
                        </span>
                      </div>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        style={{ marginTop: 8, width: '100%' }}
                        onClick={() => handleRestock(item)}
                      >
                        立即补充
                      </Button>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          <Table
            columns={inventoryColumns}
            dataSource={inventory}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1000 }}
            rowClassName={(record) =>
              record.quantity < record.minStock ? 'low-stock-row' : ''
            }
          />
        </TabPane>
      </Tabs>

      <Modal
        title="工单详情 - 备件清单"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {selectedOrder && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p><strong>工单编号：</strong>{selectedOrder.id}</p>
              <p><strong>设备名称：</strong>{getEquipmentName(selectedOrder.equipmentId)}</p>
              <p><strong>所属机组：</strong>{getUnitNo(selectedOrder.unitId)}</p>
              <p><strong>描述：</strong>{selectedOrder.description}</p>
            </div>
            <Table
              columns={partsColumns}
              dataSource={selectedOrder.parts}
              rowKey="partId"
              pagination={false}
              size="small"
              summary={(pageData) => {
                const total = pageData.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3} align="right">
                      <strong>合计：</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <strong>{total.toFixed(2)} 元</strong>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </div>
        )}
      </Modal>

      <Modal
        title="补充库存"
        open={restockModalVisible}
        onOk={handleRestockSubmit}
        onCancel={() => setRestockModalVisible(false)}
        okText="确认"
        cancelText="取消"
        width={400}
      >
        {selectedInventory && (
          <div>
            <p style={{ marginBottom: 16 }}>
              <strong>备件名称：</strong>{selectedInventory.partName}<br />
              <strong>当前库存：</strong>{selectedInventory.quantity}<br />
              <strong>最低库存：</strong>{selectedInventory.minStock}
            </p>
            <Form form={form} layout="vertical">
              <Form.Item
                name="quantity"
                label="补充数量"
                rules={[
                  { required: true, message: '请输入补充数量' },
                  { type: 'number', min: 1, message: '数量必须大于0' }
                ]}
              >
                <InputNumber
                  min={1}
                  placeholder="请输入补充数量"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <style>{`
        .maintenance-due-soon {
          background-color: #fff7e6 !important;
        }
        .low-stock-row {
          background-color: #fffbe6 !important;
        }
        .ant-table-tbody > .low-stock-row:hover > td {
          background-color: #fff3cd !important;
        }
        .ant-table-tbody > .maintenance-due-soon:hover > td {
          background-color: #ffe7ba !important;
        }
      `}</style>
    </div>
  );
};

export default EquipmentMaintenance;
