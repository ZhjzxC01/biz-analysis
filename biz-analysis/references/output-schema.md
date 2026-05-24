# 产出格式定义

> 本文件定义 biz-analysis 的全部产出格式。Phase 6 生成报告时加载。

---

## analysis-data.json Schema

```json
{
  "meta": {
    "project_name": "string",
    "analysis_version": "string",
    "generated_at": "date",
    "completion_score": {
      "input_sufficiency": "number (0-20)",
      "analysis_coverage": "number (0-30)",
      "risk_identification": "number (0-25)",
      "industry_alignment": "number (0-25)",
      "total": "number (0-100)"
    }
  },
  "business_context": {
    "background": "string",
    "goals": ["string"],
    "pain_points": ["string"],
    "existing_systems": ["string"],
    "roles": ["string"],
    "industry": "string",
    "domain": ["string"],
    "ddd_bounded_contexts": [
      {
        "name": "string",
        "description": "string",
        "type": "core|supporting|generic"
      }
    ]
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
      "acceptance_criteria": ["string (Gherkin BDD 格式: Given-When-Then)"],
      "dependencies": ["string"]
    }
  ],
  "feature_tree": {
    "text": "string (text format)",
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
    "openapi_spec_yaml": "string (OpenAPI Specification 3.0 YAML string)"
  }
}
```

### Schema 自动化校验规则

Phase 6 生成 `analysis-data.json` 后，**必须运行自动化校验脚本进行硬编码验证**，确保 100% 格式与逻辑无误。

**校验操作说明：**
* 必须在 bash 终端中执行以下命令：
  ```bash
  node scripts/validate_schema.js <项目目录>/analysis-data.json
  ```
* 遇到报错（如 `exit(1)`），Agent **必须原地回溯分析**，修改不一致或损坏的 JSON 数据项，重新运行校验直至控制台输出 `🟢 Schema validation successful!` 且 `exit(0)`。

**该脚本将自动执行以下深度核对：**

**1. 必填与类型检查：**
- `meta.project_name` — 非空字符串，完成度评分 `total` 处于 0-100 之间。
- `business_context.background`、`business_context.roles` 等关键字段完整性。
- 实体的 `confidence`（high/medium/low）、特性的 `priority`（P0/P1/P2）等类型验证。

**2. 深度引用完整性校验：**
- `features[].role` 必须存在于 `business_context.roles` 或 `business_model.roles[].name`。
- `business_model.relationships[].from` 和 `.to` 必须存在于 `business_model.entities[].name`。
- `features[].dependencies` 引用的功能必须存在于 `features[].feature`（杜绝循环或虚无依赖）。
- `missing_requirements` 中 status 为 `adopted` 的条目必须在 features 功能点中找到名称/描述相匹配的实装项。

**3. 语法与格式检查：**
- JSON 语法合法。
- 枚举值（priority、confidence、type、status 等）符合 Schema 定义。
- `openapi_spec_yaml` 是合法的 YAML 格式。

---

## analysis-report.md 结构

```markdown
# <项目名称> 业务分析报告

## 1. 业务上下文
（Phase 1 输出）

## 2. 业务模型
### 2.1 核心实体
### 2.2 实体关系
### 2.3 状态机
### 2.4 业务流程
### 2.5 角色与权限

## 3. 功能清单
### 3.1 功能树
### 3.2 功能详情（含优先级、用户故事）
### 3.3 MVP 范围定义

## 4. 风险评估
### 4.1 高风险项
### 4.2 中风险项
### 4.3 缺失需求（AI推导）
### 4.4 异常场景
### 4.5 非功能性需求

## 5. 系统设计建议
### 5.1 数据模型
### 5.2 API 清单
### 5.3 集成架构
### 5.4 微服务边界

## 6. 完成度评分
（四维评分 + 建议）

## 7. 交接说明
（如何使用 pm-html-pdt-fused 继续）
```

---

## feature-tree.txt 格式

```
系统名称
├── 模块A [P0]
│   ├── 功能1 [P0]
│   ├── 功能2 [P1]
│   └── 功能3 [P2]
├── 模块B [P1]
│   └── ...
└── 系统设置 [P1]
    └── ...
```

---

## 与 pm-html-pdt-fused 的交接协议

### 交接文件
分析完成后，在项目目录下生成 `<project>/analysis-data.json`

### 交接方式
1. 用户在对话中说「基于上面的分析，生成PRD」→ 提示用户调用 `/pm-html-pdt-fused` 并引用 analysis-data.json
2. 用户手动调用 `/pm-html-pdt-fused`，在输入中引用 analysis-data.json 路径

### 交接内容映射

| biz-analysis 产出 | pm-html-pdt-fused 消费方式 |
|---|---|
| business_context | 作为项目背景输入 |
| business_model.entities | 生成数据字典 |
| business_model.processes | 生成流程图 |
| features | 作为功能清单输入 |
| feature_tree.modules | 作为功能结构 |
| system_design.data_model | 参考数据库设计 |
| risks | 写入 PRD 风险章节 |

### 扩展下游

如需对接其他下游工具（如代码生成、测试用例生成），在 `<project>/analysis-data.json` 中消费对应字段即可，无需修改 Skill。
