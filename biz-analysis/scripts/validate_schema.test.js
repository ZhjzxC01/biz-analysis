const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const VALIDATOR = path.resolve(__dirname, 'validate_schema.js');
const tmpDir = path.resolve(__dirname, '../.test-tmp');

function writeTmpJson(data) {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const file = path.join(tmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

function runValidator(filePath) {
  try {
    const stdout = execFileSync('node', [VALIDATOR, filePath], { encoding: 'utf8', timeout: 5000 });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

// 合法的完整 JSON 基础模板
function validData() {
  return {
    meta: {
      project_name: 'test-project',
      analysis_version: '1.0',
      generated_at: '2026-05-23',
      completion_score: {
        input_sufficiency: 16,
        analysis_coverage: 25,
        risk_identification: 20,
        industry_alignment: 18,
        total: 79
      }
    },
    business_context: {
      background: '测试业务背景',
      goals: ['目标1'],
      pain_points: ['痛点1'],
      existing_systems: ['系统A'],
      roles: ['客服', '管理员'],
      industry: 'SaaS',
      domain: ['客服']
    },
    business_model: {
      entities: [
        { name: '工单', description: '工单实体', key_attributes: ['title'], confidence: 'high' },
        { name: '客户', description: '客户实体', key_attributes: ['name'], confidence: 'high' }
      ],
      relationships: [
        { from: '客户', to: '工单', type: '1:N', description: '客户提交工单' }
      ],
      state_machines: [
        {
          entity: '工单',
          states: ['草稿', '处理中', '已关闭'],
          transitions: [
            { from: '草稿', to: '处理中', trigger: '提交', conditions: '无' },
            { from: '处理中', to: '已关闭', trigger: '关闭', conditions: '无' }
          ]
        }
      ],
      processes: [
        { name: '工单处理流程', type: 'main', steps: ['创建', '处理', '关闭'], actors: ['客服'] }
      ],
      roles: [
        { name: '客服', description: '客服人员', permissions: ['创建工单'] },
        { name: '管理员', description: '管理员', permissions: ['全部'] }
      ]
    },
    features: [
      {
        module: '工单管理', feature: '创建工单', role: '客服',
        priority: 'P0', user_story: '作为客服，我希望创建工单',
        acceptance_criteria: ['Given 已登录 When 点击创建 Then 成功'], dependencies: []
      },
      {
        module: '工单管理', feature: '分配工单', role: '管理员',
        priority: 'P0', user_story: '作为管理员，我希望分配工单',
        acceptance_criteria: ['Given 待分配 When 分配 Then 状态变更'], dependencies: ['创建工单']
      }
    ],
    feature_tree: {
      text: '工单管理\n├── 创建工单 [P0]\n└── 分配工单 [P0]',
      modules: [
        { name: '工单管理', priority: 'P0', features: [{ name: '创建工单', priority: 'P0' }, { name: '分配工单', priority: 'P0' }] }
      ]
    },
    risks: [
      { level: 'high', category: '数据迁移', description: '迁移风险', impact: '高', suggestion: '分批迁移', resolution: 'pending' }
    ],
    missing_requirements: [
      { description: '创建工单防重复提交', reason: '用户可能重复', priority: 'P0', status: 'adopted', confidence: 'medium' }
    ],
    system_design: {
      data_model: [{ table: 'ticket', description: '工单表', key_fields: ['id', 'title', 'status'] }],
      api_design: [{ method: 'POST', path: '/api/v1/tickets', description: '创建工单', actor: '客服' }],
      integration: [{ system: '企微', type: 'async', description: '通知推送' }],
      service_boundary: [{ service: 'ticket-service', responsibility: '工单管理', dependencies: ['user-service'] }]
    }
  };
}

describe('validate_schema.js', () => {

  let tmpFiles = [];

  beforeEach(() => {
    tmpFiles = [];
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  function tmp(data) {
    const f = writeTmpJson(data);
    tmpFiles.push(f);
    return f;
  }

  // --- 正向测试 ---

  it('合法完整 JSON 应通过校验', () => {
    const r = runValidator(tmp(validData()));
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes('Schema validation successful'));
  });

  // --- meta 测试 ---

  it('缺少 project_name 应报错', () => {
    const d = validData();
    delete d.meta.project_name;
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('project_name'));
  });

  it('completion_score.total 超出 0-100 应报错', () => {
    const d = validData();
    d.meta.completion_score.total = 150;
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('total'));
  });

  it('input_sufficiency 超出 0-20 应报错', () => {
    const d = validData();
    d.meta.completion_score.input_sufficiency = 25;
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('input_sufficiency'));
  });

  // --- 实体引用测试 ---

  it('relationship 引用不存在的 entity 应报错', () => {
    const d = validData();
    d.business_model.relationships[0].from = '不存在的实体';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('不存在的实体'));
  });

  // --- 状态机引用测试 ---

  it('transition.from 不在 states 中应报错', () => {
    const d = validData();
    d.business_model.state_machines[0].transitions[0].from = '非法状态';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('非法状态'));
  });

  it('transition.to 不在 states 中应报错', () => {
    const d = validData();
    d.business_model.state_machines[0].transitions[0].to = '非法状态';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('非法状态'));
  });

  // --- 角色引用测试 ---

  it('feature.role 不在 roles 中应报错', () => {
    const d = validData();
    d.features[0].role = '未知角色';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('未知角色'));
  });

  it('"系统" 作为 feature.role 不应报错', () => {
    const d = validData();
    d.features[0].role = '系统';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 0);
  });

  it('"system" 作为 api actor 不应报错', () => {
    const d = validData();
    d.system_design.api_design[0].actor = 'system';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 0);
  });

  // --- 依赖引用测试 ---

  it('dependency 引用不存在的 feature 应报错', () => {
    const d = validData();
    d.features[1].dependencies = ['不存在的功能'];
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('不存在的功能'));
  });

  it('dependency 引用存在的 feature 不应报错', () => {
    const d = validData();
    d.features[1].dependencies = ['创建工单'];
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 0);
  });

  // --- adopted 匹配测试 ---

  it('adopted 需求与 feature 精确匹配应通过', () => {
    const d = validData();
    d.missing_requirements[0].description = '创建工单';
    d.missing_requirements[0].status = 'adopted';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 0);
  });

  it('adopted 需求与 feature 关键词匹配应通过', () => {
    const d = validData();
    d.missing_requirements[0].description = '创建工单 防重复提交';
    d.missing_requirements[0].status = 'adopted';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 0);
  });

  it('adopted 需求无匹配应报错', () => {
    const d = validData();
    d.missing_requirements[0].description = '完全不相关的功能';
    d.missing_requirements[0].status = 'adopted';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('完全不相关的功能'));
  });

  it('pending/rejected 需求不需要匹配 features', () => {
    const d = validData();
    d.missing_requirements[0].description = '完全不相关的功能';
    d.missing_requirements[0].status = 'pending';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 0);
  });

  // --- 枚举值测试 ---

  it('无效 priority 应报错', () => {
    const d = validData();
    d.features[0].priority = 'P3';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('P3'));
  });

  it('无效 confidence 应报错', () => {
    const d = validData();
    d.business_model.entities[0].confidence = 'very_high';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('very_high'));
  });

  it('无效 relationship type 应报错', () => {
    const d = validData();
    d.business_model.relationships[0].type = '2:N';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('2:N'));
  });

  it('无效 process type 应报错', () => {
    const d = validData();
    d.business_model.processes[0].type = 'unknown';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('unknown'));
  });

  it('无效 risk level 应报错', () => {
    const d = validData();
    d.risks[0].level = 'critical';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('critical'));
  });

  it('无效 missing_requirement status 应报错', () => {
    const d = validData();
    d.missing_requirements[0].status = 'maybe';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('maybe'));
  });

  // --- feature_tree 一致性测试 ---

  it('feature_tree 中功能不在 features 列表应报错', () => {
    const d = validData();
    d.feature_tree.modules[0].features.push({ name: '幽灵功能', priority: 'P0' });
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('幽灵功能'));
  });

  it('feature_tree 中功能与 features 一致应通过', () => {
    const d = validData();
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 0);
  });

  // --- DDD bounded contexts 测试 ---

  it('无效 ddd_bounded_contexts type 应报错', () => {
    const d = validData();
    d.business_context.ddd_bounded_contexts = [
      { name: 'TestCtx', description: 'test', type: 'invalid' }
    ];
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('invalid'));
  });

  it('有效 ddd_bounded_contexts 应通过', () => {
    const d = validData();
    d.business_context.ddd_bounded_contexts = [
      { name: 'CoreDomain', description: '核心域', type: 'core' },
      { name: 'GenericDomain', description: '通用域', type: 'generic' }
    ];
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 0);
  });

  // --- 非法 JSON 文件测试 ---

  it('不存在的文件应报错', () => {
    const r = runValidator('/nonexistent/path.json');
    assert.strictEqual(r.exitCode, 1);
  });

  it('非法 JSON 语法应报错', () => {
    const file = path.join(tmpDir, 'invalid-syntax.json');
    fs.writeFileSync(file, '{ broken json }');
    tmpFiles.push(file);
    const r = runValidator(file);
    assert.strictEqual(r.exitCode, 1);
  });

  // --- integration type 测试 ---

  it('无效 integration type 应报错', () => {
    const d = validData();
    d.system_design.integration[0].type = 'websocket';
    const r = runValidator(tmp(d));
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stderr.includes('websocket'));
  });
});
