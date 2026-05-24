# Phase 5 系统设计辅助方法论

> 本文件在 Phase 5 时加载。

---

## 数据模型建议

### 表结构设计原则

- **聚合根与事务边界**：对于 DDD 战术建模，每一张主表对应一个**聚合根 (Aggregate Root)**。聚合根内部关联的实体或**值对象**（如工单关联的收货地址）可作为子表或直接以 JSON/属性字段嵌入，确保在聚合根边界内的操作保持事务一致性。
- 每个核心实体至少一张主表
- 关联关系通过外键字段体现
- 状态字段使用枚举值
- 时间字段统一使用 created_at / updated_at
- 软删除使用 deleted_at（不物理删除）

### 核心表模板

```
<实体名>_table:
  id              BIGINT PRIMARY KEY
  <业务编号>      VARCHAR UNIQUE  -- 如 ticket_no
  <状态字段>      ENUM            -- 如 status
  <核心属性>      <类型>          -- 如 title, priority
  <关联外键>      BIGINT          -- 如 customer_id, assignee_id
  created_at      DATETIME
  updated_at      DATETIME
  deleted_at      DATETIME NULL
```

### 辅助表类型

| 表类型 | 用途 | 示例 |
|---|---|---|
| 日志表 | 记录操作历史 | ticket_log |
| 评论表 | 记录沟通内容 | ticket_comment |
| 附件表 | 存储文件信息 | attachment |
| 配置表 | 存储业务规则 | sla_rule |
| 关联表 | N:M 关系 | ticket_tag |

---

## 状态机设计

### 设计规则

1. 每个有生命周期的实体都需要状态机
2. 状态流转必须有明确的触发条件
3. 标注不可逆状态（如：已归档）
4. 标注超时规则（如：48h 未处理自动升级）
5. 标注回退路径（如：驳回→回到草稿）

### 呈现格式

```markdown
### <实体名> 状态机

[状态A] --触发条件--> [状态B]
[状态A] --超时条件--> [状态C]

不可逆状态：[已归档]
超时规则：[待处理] 超过24h → [已升级]
```

---

## API 能力建议

### API 设计原则

- RESTful 风格
- 统一前缀：`/api/v1/<resource>`
- 标准方法：GET(查询) / POST(创建) / PUT(更新) / DELETE(删除)
- 每个 API 标注调用角色

### API 清单模板

| 方法 | 路径 | 描述 | 调用角色 |
|---|---|---|---|
| POST | /api/v1/tickets | 创建工单 | 客服 |
| GET | /api/v1/tickets | 查询工单列表 | 客服/处理人 |
| GET | /api/v1/tickets/{id} | 查询工单详情 | 客服/处理人 |
| PUT | /api/v1/tickets/{id}/assign | 分配工单 | 管理员 |
| PUT | /api/v1/tickets/{id}/transfer | 转派工单 | 处理人 |
| PUT | /api/v1/tickets/{id}/close | 关闭工单 | 处理人/客服 |

### OpenAPI 3.0 规范集成 (必填项)

Agent 必须在交付物 `openapi_spec_yaml` 字段中提供符合 **OpenAPI Specification 3.0** 标准的接口规范 YAML 代码。模板格式示例如下：

```yaml
openapi: 3.0.3
info:
  title: B端客服工单系统 API
  version: 1.0.0
  description: 提供工单创建、分配、转派与关闭的标准企业级 RESTful API 接口。
paths:
  /api/v1/tickets:
    post:
      summary: 创建客服工单
      x-actor: 客服/客户
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title, customer_id]
              properties:
                title:
                  type: string
                description:
                  type: string
      responses:
        '201':
          description: 工单创建成功
```

---

## 集成架构设计

### 集成方式选择

| 方式 | 适用场景 | 优点 | 缺点 |
|---|---|---|---|
| 同步 API | 实时性要求高、数据量小 | 简单、实时 | 耦合度高 |
| 异步消息 | 解耦、削峰、可重试 | 松耦合、可靠 | 实时性差 |
| 批量同步 | 数据量大、实时性要求低 | 效率高 | 延迟大 |

### 集成清单模板

| 对接系统 | 用途 | 集成方式 | 数据流向 | 频率 |
|---|---|---|---|---|
| ERP | 客户信息查询 | 同步API+缓存 | ERP→本系统 | 按需 |
| 企微 | 消息推送 | 异步Webhook | 本系统→企微 | 实时 |
| OA | 审批流 | 消息队列 | 双向 | 实时 |

---

## 微服务边界建议

### 服务拆分原则

- 按业务域拆分（每个服务负责一个业务域）
- 服务间通过 API 或消息通信
- 每个服务有自己的数据存储
- 服务边界对应团队边界（康威定律）

### 服务清单模板

| 服务名 | 职责 | 依赖 |
|---|---|---|
| ticket-service | 工单CRUD、状态管理 | user-service, notification-service |
| sla-service | SLA规则管理、超时监控 | ticket-service |
| notification-service | 消息推送 | 企微API, 短信API |
| user-service | 用户管理、权限管理 | SSO |

---

## 数据一致性方案

### 方案选择

| 场景 | 推荐方案 |
|---|---|
| 同一服务内 | 数据库事务 |
| 跨服务、实时性要求高 | 分布式事务（Saga） |
| 跨服务、可接受延迟 | 最终一致性（消息队列） |
| 数据同步 | 定时任务 + 幂等设计 |

---

## 与下游交接

交接协议（交接文件、交接方式、交接内容映射）定义在 [output-schema.md](output-schema.md)。Phase 6 生成报告时加载该文件。
