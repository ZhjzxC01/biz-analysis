# B端业务系统分析与设计 Skill 设计规范

> 版本: 3.0 | 日期: 2026-05-23 | 状态: 已批准

## 1. 定位与边界

| 维度 | 定义 |
|---|---|
| 定位 | B端业务系统分析与设计 AI（业务分析师角色） |
| 边界 | 仅限业务需求分析和业务系统设计，不涉及PRD/原型生成 |
| 与 pm-html-pdt-fused | 互补分工：本 Skill 做分析，分析完可交接给 pm-html-pdt-fused 生成文档 |
| 核心差异化 | 主动分析、提问、建议，而非被动执行 |
| 目标用户 | 产品/业务人员、技术架构人员、项目管理人员 |

## 2. 文件结构

```
~/.claude/skills/biz-analysis/
├── SKILL.md                          # 主入口（~430行）
├── references/
│   ├── analysis-methods.md           # Phase 1-3 方法论 + 行业模板 + 状态机模板
│   ├── risk-completeness.md          # Phase 4 方法论 + 回溯触发条件
│   ├── system-design.md              # Phase 5 方法论
│   └── output-schema.md              # 产出格式 + Schema 校验规则 + 交接协议
└── examples/
    └── ticket-system-demo.md         # 端到端示例（含复杂场景示例）
```

### 文件分层与加载策略

- **SKILL.md**：定位、核心规则（9条）、工作流总览、路由逻辑、产出格式引用
- **references/**：按需加载，进入 Phase N 时加载对应文件，不在 Phase N 时不加载
- **examples/**：Claude 参考用，不直接加载

## 3. 核心设计决策

| # | 决策项 | 方案 |
|---|---|---|
| 1 | 工作流 | 7 阶段（含增量修正阶段）+ 7 个 HARD-GATE（含 Phase 5 回溯检查） |
| 2 | 流程方向 | 默认前进 + 回溯修正机制（Phase 3/4/5 均有回溯检查点） |
| 3 | 问题交互 | 分级处理（P0即时/P1步骤末/P2阶段末）+ 交互模板 |
| 4 | 多轮追问 | 支持，最多5轮，连续3轮无明确答案标记待确认 |
| 5 | 置信度 | 每个结论附 🟢高/🟡中/🔴低 标记 |
| 6 | 输出格式 | MD报告 + JSON（含 Schema 校验）+ 功能树 |
| 7 | 迭代能力 | Phase 6 后支持增量修正 |
| 8 | 纠错机制 | 区分增量修正（追加）和纠错修正（回溯重跑） |
| 9 | 完成度评分 | 四维评分（输入充分度/分析覆盖率/风险识别率/行业对标度） |
| 10 | 上下文管理 | 大输入分段摘要（动态阈值），reference按需加载，分段操作指南 |
| 11 | 复杂度分级 | 不做，统一标准流程 |
| 12 | 进度反馈 | 每个 Phase 开始时展示进度（N/7）+ 预估剩余时间 |
| 13 | 交互模板 | Phase 1-5 均有标准确认模板 |
| 14 | 死锁保护 | HARD-GATE 连续3轮无确认→二选一→按确定推进+标记待确认 |
| 15 | Schema 校验 | Phase 6 产出 JSON 必须通过必填/引用/一致性/格式四层校验 |
| 16 | 工具权限 | Read + Edit + Write + find + Glob + Grep + WebSearch |

## 4. 工作流详细设计

### Phase 1: 资料接入与清洗

- Step 1.1: 输入评估（充分/部分充分/不充分 → 引导补全）
- Step 1.2: 资料清洗（术语统一/去噪/合并）
- Step 1.3: 业务上下文提取
- **HARD-GATE**: 用户确认业务上下文
- **不可跳过**

### Phase 2: 业务理解与建模

- 行业/业务域识别（🟢置信度）
- 核心实体 + 关系分析（🟢/🟡置信度）
- 状态机生成
- 流程识别（主流程/分支/异常）
- 角色 + 权限分析
- 价值流 + 数据流分析
- **HARD-GATE**: 用户确认业务模型
- **不可跳过**

### Phase 3: 功能拆解与优先级

- 模块→页面→功能点拆解
- 功能树生成
- 用户故事生成
- MoSCoW优先级分层
- MVP范围界定
- 功能依赖分析
- **回溯检查**: 功能是否完整覆盖业务流程？
- **HARD-GATE**: 用户确认功能清单
- **不可跳过**

### Phase 4: 风险扫描与完整性检查

- 8维度风险扫描
- AI推导缺失需求（🔴/🟡置信度）
- 异常场景推导
- 隐含规则补全
- NFR识别
- **回溯检查**: 风险是否需要修改前序Phase？
- **HARD-GATE**: 用户确认风险评估
- **可跳过**

### Phase 5: 系统设计辅助

- 数据模型建议
- 状态机设计
- API清单
- 集成架构设计
- 微服务边界建议
- **HARD-GATE**: 用户确认设计方向
- **可跳过**

### Phase 6: 生成分析报告

- Step 6.1: 汇总前5阶段产出
- Step 6.2: 一致性自检
- Step 6.3: 生成完成度评分
- Step 6.4: 输出文件（analysis-report.md + analysis-data.json + feature-tree.txt）
- Step 6.5: 交接提示
- **HARD-GATE**: 用户审阅最终报告

### Phase 7: 增量修正（可选，用户发起）

- 用户指定要修改的部分
- Skill 判断修正类型（增量/纠错/优先级调整）
- 确定回溯范围
- 仅重跑受影响的Phase
- 更新产出文件

## 5. 问题交互机制

### 问题分级

| 级别 | 触发条件 | 处理方式 |
|---|---|---|
| P0-阻塞 | 矛盾信息、关键缺失、根本性误解 | 立即打断 |
| P1-重要 | 模糊描述、关键风险、需求冲突 | 攒到步骤末呈现 |
| P2-建议 | 缺失需求（AI推导）、优化建议 | 攒到阶段末呈现 |

### 多轮追问规则

```
追问策略（按问题复杂度动态调整，非固定轮数）：
├── 用户明确回答 → 信息充分，停止追问
├── 用户说「你决定」/「按常见做法」→ 立即停止，按推导处理
├── 问题涉及多维度 → 每个维度单独追问，但不同时问超过2个维度
├── 连续3轮未获得明确答案 → 总结当前理解 + 暂定方案 + 标记「待确认」，不再追问
└── 追问总轮数上限：5轮（防止无限循环）
```

**核心原则：不是限制轮数，而是防止无效循环。**

### 置信度标记

| 置信度 | 条件 | 呈现方式 |
|---|---|---|
| 🟢 高 | 基于明确关键词/结构化数据推断 | 直接呈现 |
| 🟡 中 | 基于上下文推断，有依据但非100%确定 | 呈现 + 标注「请确认」 |
| 🔴 低 | 基于猜测/行业类比，缺乏直接证据 | 呈现 + 标注「仅供参考」+ 提供替代选项 |

### 分析中断规则

```
用户中途修正：
├── 当前步骤已完成 → 立即停下，修正后重跑当前步骤
├── 当前步骤进行中 → 停下来，修正后从当前步骤的当前子步骤重跑
├── 修正影响前序Phase → 先完成当前Phase，Phase结束时触发回溯
└── 修正不阻塞当前分析 → 记录，Phase末统一处理
```

## 6. 回溯与纠错机制

### 回溯检查点

- Phase 3 结束：检查功能是否完整覆盖业务流程
- Phase 4 结束：检查风险是否需要修改前序Phase

### 修正类型与回溯深度

| 修正类型 | 场景 | 处理 | 回溯范围 |
|---|---|---|---|
| 增量修正 | 「还要加一个XX功能」 | 当前Phase追加 | 无回溯 |
| 优先级调整 | 「这个功能优先级改一下」 | 仅修改Phase 3 | 无回溯 |
| 纠错修正（Phase 1） | 上下文理解错误 | 回溯重跑 | Phase 1-6 |
| 纠错修正（Phase 2） | 实体/关系/流程错误 | 回溯重跑 | Phase 2-6 |
| 纠错修正（Phase 3） | 功能拆解错误 | 回溯重跑 | Phase 3-6 |
| 纠错修正（Phase 4） | 风险评估错误 | 回溯重跑 | Phase 4-6 |
| 纠错修正（Phase 5） | 设计建议错误 | 回溯重跑 | Phase 5-6 |

## 7. 上下文管理策略

| 输入规模 | 处理方式 |
|---|---|
| <5万字 | 原文全部读入，正常分析 |
| 5-20万字 | 分段读入，每段提取摘要，保留关键段原文 |
| >20万字 | 仅读目录/摘要/关键章节，跳过细节，Phase 1 输出中标注「未读取的部分」 |

- Reference 文件按 Phase 需要加载，Phase 切换时前一个 Phase 的 reference 可释放
- Phase 6 自检前，先压缩前序 Phase 的中间产出为摘要
- analysis-data.json 始终保存完整数据（不压缩）

## 8. 完成度评分

### 评分维度（满分100）

| 维度 | 分值 | 评分标准 |
|---|---|---|
| 输入充分度 | 20分 | 资料覆盖背景/角色/流程/规则/系统 5个维度 |
| 分析覆盖率 | 30分 | 功能清单覆盖已识别业务流程的比例 |
| 风险识别率 | 25分 | 发现风险数 + 高风险解决方案覆盖率 |
| 行业对标度 | 25分 | AI推导行业标准功能集的覆盖比例 |

### 行业对标度基准

采用 AI推导方式：Skill 基于自身知识推导该行业/系统类型的标准功能集，对比用户的功能清单。标注推导依据的置信度。

## 9. 产出格式

### 产出文件

- `<project>/analysis-report.md` — 人类可读完整报告
- `<project>/analysis-data.json` — 结构化数据（供 pm-html-pdt-fused 消费）
- `<project>/feature-tree.txt` — 功能树文本

### analysis-data.json Schema

```json
{
  "meta": {
    "project_name": "string",
    "analysis_version": "string",
    "generated_at": "date",
    "completion_score": {
      "input_sufficiency": "number",
      "analysis_coverage": "number",
      "risk_identification": "number",
      "industry_alignment": "number",
      "total": "number"
    }
  },
  "business_context": {
    "background": "string",
    "goals": ["string"],
    "pain_points": ["string"],
    "existing_systems": ["string"],
    "roles": ["string"],
    "industry": "string",
    "domain": ["string"]
  },
  "business_model": {
    "entities": [
      {
        "name": "string",
        "description": "string",
        "key_attributes": ["string"],
        "confidence": "high|medium|low"
      }
    ],
    "relationships": [
      {
        "from": "string",
        "to": "string",
        "type": "1:1|1:N|N:M",
        "description": "string"
      }
    ],
    "state_machines": [
      {
        "entity": "string",
        "states": ["string"],
        "transitions": [
          {
            "from": "string",
            "to": "string",
            "trigger": "string",
            "conditions": "string"
          }
        ]
      }
    ],
    "processes": [
      {
        "name": "string",
        "type": "main|branch|exception|approval",
        "steps": ["string"],
        "actors": ["string"]
      }
    ],
    "roles": [
      {
        "name": "string",
        "description": "string",
        "permissions": ["string"]
      }
    ]
  },
  "features": [
    {
      "module": "string",
      "feature": "string",
      "role": "string",
      "priority": "P0|P1|P2",
      "user_story": "string",
      "acceptance_criteria": ["string"],
      "dependencies": ["string"]
    }
  ],
  "feature_tree": {
    "text": "string",
    "modules": [
      {
        "name": "string",
        "priority": "P0|P1|P2",
        "features": [
          {
            "name": "string",
            "priority": "P0|P1|P2"
          }
        ]
      }
    ]
  },
  "risks": [
    {
      "level": "high|medium|low",
      "category": "string",
      "description": "string",
      "impact": "string",
      "suggestion": "string",
      "resolution": "string|pending"
    }
  ],
  "missing_requirements": [
    {
      "description": "string",
      "reason": "string",
      "priority": "P0|P1|P2",
      "status": "adopted|pending|rejected",
      "confidence": "high|medium|low"
    }
  ],
  "system_design": {
    "data_model": [
      {
        "table": "string",
        "description": "string",
        "key_fields": ["string"]
      }
    ],
    "api_design": [
      {
        "method": "string",
        "path": "string",
        "description": "string",
        "actor": "string"
      }
    ],
    "integration": [
      {
        "system": "string",
        "type": "sync|async|batch",
        "description": "string"
      }
    ],
    "service_boundary": [
      {
        "service": "string",
        "responsibility": "string",
        "dependencies": ["string"]
      }
    ],
    "openapi_spec_yaml": "string"
  }
}
```

## 10. 与 pm-html-pdt-fused 交接协议

### 交接方式

1. 分析完成后，生成 `<project>/analysis-data.json`
2. 用户可直接说「基于上面的分析，生成PRD」
3. 或手动调用 `/pm-html-pdt-fused`，引用 analysis-data.json

### 交接内容映射

| biz-analysis 产出 | pm-html-pdt-fused 输入 |
|---|---|
| business_context | 项目背景信息 |
| business_model.entities | 数据字典基础 |
| business_model.processes | 流程图基础 |
| features | 功能清单 |
| feature_tree | 功能结构 |
| system_design.data_model | 数据库设计参考 |
| risks | PRD风险章节 |
