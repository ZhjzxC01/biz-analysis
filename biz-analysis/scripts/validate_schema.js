/**
 * biz-analysis JSON Schema Validator
 * 
 * 这是一个原生、零外部依赖的 Node.js 校验脚本，用于验证 `analysis-data.json` 
 * 的结构完整性、枚举值合法性以及深度引用完整性。
 * 
 * 使用方法：
 *   node scripts/validate_schema.js <path_to_json_file>
 */

const fs = require('fs');
const path = require('path');

// 系统角色常量：这些角色无需在 roles 定义中声明即可被引用
const SYSTEM_ROLES = new Set(['系统', 'system']);

/**
 * 关键词提取：按空格/标点/常见分隔符拆分，过滤掉过短的词
 */
function extractKeywords(text) {
  return new Set(
    text.split(/[\s,，。、;；:：\-_\/\\()（）\[\]【】{}]+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2)
  );
}

/**
 * 判断 adopted 需求是否在 features 中有对应功能
 * 策略：关键词交集匹配
 * - 需求关键词仅 1 个时，要求精确匹配
 * - 否则交集 >= 2 个，或交集占比 >= 50% 需求关键词数
 */
function isRequirementMatched(reqDesc, featureSet) {
  const reqKeywords = extractKeywords(reqDesc);
  if (reqKeywords.size === 0) return false;

  for (const featureName of featureSet) {
    const featKeywords = extractKeywords(featureName);
    const intersection = [...reqKeywords].filter(k => featKeywords.has(k));

    if (reqKeywords.size === 1) {
      // 单关键词需求：要求精确匹配或子串包含
      const kw = [...reqKeywords][0];
      if (featureName.includes(kw) || kw.includes(featureName)) return true;
    } else {
      // 多关键词需求：交集 >= 2 或交集占比 >= 50%
      if (intersection.length >= 2) return true;
      if (reqKeywords.size > 0 && intersection.length / reqKeywords.size >= 0.5) return true;
    }
  }
  return false;
}

// 命令行参数检查
if (process.argv.length < 3) {
  console.error('\x1b[31mError: 请提供要校验的 JSON 文件路径！\x1b[0m');
  console.log('用法: node scripts/validate_schema.js <path_to_analysis_data.json>');
  process.exit(1);
}

const targetPath = path.resolve(process.argv[2]);

if (!fs.existsSync(targetPath)) {
  console.error(`\x1b[31mError: 文件不存在: ${targetPath}\x1b[0m`);
  process.exit(1);
}

let data;
try {
  const content = fs.readFileSync(targetPath, 'utf8');
  data = JSON.parse(content);
} catch (err) {
  console.error(`\x1b[31mError: 无法解析 JSON 文件: ${err.message}\x1b[0m`);
  process.exit(1);
}

const errors = [];
const warnings = [];

function addError(path, message) {
  errors.push(`[${path}]: ${message}`);
}

function addWarning(path, message) {
  warnings.push(`[${path}]: ${message}`);
}

function checkType(value, expectedType, path) {
  if (value === undefined || value === null) {
    addError(path, '缺少必填字段或值为 null');
    return false;
  }
  
  if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      addError(path, `类型错误：期望为 Array，实际为 ${typeof value}`);
      return false;
    }
    return true;
  }
  
  if (typeof value !== expectedType) {
    addError(path, `类型错误：期望为 ${expectedType}，实际为 ${typeof value}`);
    return false;
  }
  return true;
}

// 1. 验证 meta 模块
if (checkType(data.meta, 'object', 'meta')) {
  checkType(data.meta.project_name, 'string', 'meta.project_name');
  checkType(data.meta.analysis_version, 'string', 'meta.analysis_version');
  checkType(data.meta.generated_at, 'string', 'meta.generated_at');
  
  if (checkType(data.meta.completion_score, 'object', 'meta.completion_score')) {
    const scores = ['input_sufficiency', 'analysis_coverage', 'risk_identification', 'industry_alignment', 'total'];
    scores.forEach(s => {
      if (checkType(data.meta.completion_score[s], 'number', `meta.completion_score.${s}`)) {
        const val = data.meta.completion_score[s];
        if (s === 'input_sufficiency' && (val < 0 || val > 20)) addError(`meta.completion_score.${s}`, `得分超出范围 (0-20): ${val}`);
        if (s === 'analysis_coverage' && (val < 0 || val > 30)) addError(`meta.completion_score.${s}`, `得分超出范围 (0-30): ${val}`);
        if (s === 'risk_identification' && (val < 0 || val > 25)) addError(`meta.completion_score.${s}`, `得分超出范围 (0-25): ${val}`);
        if (s === 'industry_alignment' && (val < 0 || val > 25)) addError(`meta.completion_score.${s}`, `得分超出范围 (0-25): ${val}`);
        if (s === 'total' && (val < 0 || val > 100)) addError(`meta.completion_score.${s}`, `总得分超出范围 (0-100): ${val}`);
      }
    });
  }
}

// 2. 验证 business_context
const rolesSet = new Set();
if (checkType(data.business_context, 'object', 'business_context')) {
  checkType(data.business_context.background, 'string', 'business_context.background');
  
  if (checkType(data.business_context.goals, 'array', 'business_context.goals')) {
    data.business_context.goals.forEach((g, i) => checkType(g, 'string', `business_context.goals[${i}]`));
  }
  
  if (checkType(data.business_context.pain_points, 'array', 'business_context.pain_points')) {
    data.business_context.pain_points.forEach((p, i) => checkType(p, 'string', `business_context.pain_points[${i}]`));
  }
  
  if (checkType(data.business_context.existing_systems, 'array', 'business_context.existing_systems')) {
    data.business_context.existing_systems.forEach((sys, i) => checkType(sys, 'string', `business_context.existing_systems[${i}]`));
  }
  
  if (checkType(data.business_context.roles, 'array', 'business_context.roles')) {
    data.business_context.roles.forEach((r, i) => {
      if (checkType(r, 'string', `business_context.roles[${i}]`)) {
        rolesSet.add(r);
      }
    });
  }
  
  checkType(data.business_context.industry, 'string', 'business_context.industry');
  
  if (checkType(data.business_context.domain, 'array', 'business_context.domain')) {
    data.business_context.domain.forEach((d, i) => checkType(d, 'string', `business_context.domain[${i}]`));
  }

  // 可选的 ddd_bounded_contexts 验证
  if (data.business_context.ddd_bounded_contexts !== undefined) {
    if (checkType(data.business_context.ddd_bounded_contexts, 'array', 'business_context.ddd_bounded_contexts')) {
      data.business_context.ddd_bounded_contexts.forEach((ctx, i) => {
        if (checkType(ctx, 'object', `business_context.ddd_bounded_contexts[${i}]`)) {
          checkType(ctx.name, 'string', `business_context.ddd_bounded_contexts[${i}].name`);
          checkType(ctx.description, 'string', `business_context.ddd_bounded_contexts[${i}].description`);
          if (ctx.type !== undefined) {
            const validTypes = ['core', 'supporting', 'generic'];
            if (!validTypes.includes(ctx.type)) {
              addError(`business_context.ddd_bounded_contexts[${i}].type`, `无效的上下文类型: ${ctx.type} (期望: ${validTypes.join('/')})`);
            }
          }
        }
      });
    }
  }
}

// 3. 验证 business_model
const entitiesSet = new Set();
if (checkType(data.business_model, 'object', 'business_model')) {
  
  // 3.1 实体验证
  if (checkType(data.business_model.entities, 'array', 'business_model.entities')) {
    data.business_model.entities.forEach((entity, i) => {
      const p = `business_model.entities[${i}]`;
      if (checkType(entity, 'object', p)) {
        if (checkType(entity.name, 'string', `${p}.name`)) {
          entitiesSet.add(entity.name);
        }
        checkType(entity.description, 'string', `${p}.description`);
        if (checkType(entity.key_attributes, 'array', `${p}.key_attributes`)) {
          entity.key_attributes.forEach((attr, j) => checkType(attr, 'string', `${p}.key_attributes[${j}]`));
        }
        const confTypes = ['high', 'medium', 'low'];
        if (!confTypes.includes(entity.confidence)) {
          addError(`${p}.confidence`, `置信度类型错误: ${entity.confidence} (期望: ${confTypes.join('/')})`);
        }
      }
    });
    // entity.attributes 校验（新增设计级字段）
    data.business_model.entities.forEach((entity, i) => {
      if (entity.attributes && Array.isArray(entity.attributes)) {
        entity.attributes.forEach((attr, ai) => {
          if (!attr.name) {
            addError(`business_model.entities[${i}].attributes[${ai}].name`, '缺失');
          }
          if (!attr.type) {
            addError(`business_model.entities[${i}].attributes[${ai}].type`, '缺失');
          }
          const validFrontendTypes = ['text', 'number', 'money', 'date', 'datetime', 'select', 'multi_select', 'textarea', 'file', 'user', 'department', 'status'];
          if (attr.frontendType && !validFrontendTypes.includes(attr.frontendType)) {
            addError(`business_model.entities[${i}].attributes[${ai}].frontendType`, `非法值: ${attr.frontendType}，合法值: ${validFrontendTypes.join(', ')}`);
          }
          if (attr.validation) {
            if (typeof attr.validation.required !== 'boolean') {
              addWarning(`business_model.entities[${i}].attributes[${ai}].validation.required`, '应为 boolean');
            }
            if (attr.validation.enum && !Array.isArray(attr.validation.enum)) {
              addError(`business_model.entities[${i}].attributes[${ai}].validation.enum`, '应为数组');
            }
          }
        });
      }
    });
  }
  
  // 3.2 实体关系验证
  if (checkType(data.business_model.relationships, 'array', 'business_model.relationships')) {
    data.business_model.relationships.forEach((rel, i) => {
      const p = `business_model.relationships[${i}]`;
      if (checkType(rel, 'object', p)) {
        if (checkType(rel.from, 'string', `${p}.from`)) {
          if (!entitiesSet.has(rel.from)) {
            addError(`${p}.from`, `引用完整性错误：实体 "${rel.from}" 未在 business_model.entities 中定义`);
          }
        }
        if (checkType(rel.to, 'string', `${p}.to`)) {
          if (!entitiesSet.has(rel.to)) {
            addError(`${p}.to`, `引用完整性错误：实体 "${rel.to}" 未在 business_model.entities 中定义`);
          }
        }
        const relTypes = ['1:1', '1:N', 'N:M'];
        if (!relTypes.includes(rel.type)) {
          addError(`${p}.type`, `关系类型错误: ${rel.type} (期望: ${relTypes.join('/')})`);
        }
        checkType(rel.description, 'string', `${p}.description`);
      }
    });
  }
  
  // 3.3 状态机验证
  if (checkType(data.business_model.state_machines, 'array', 'business_model.state_machines')) {
    data.business_model.state_machines.forEach((sm, i) => {
      const p = `business_model.state_machines[${i}]`;
      if (checkType(sm, 'object', p)) {
        if (checkType(sm.entity, 'string', `${p}.entity`)) {
          if (!entitiesSet.has(sm.entity)) {
            addError(`${p}.entity`, `引用完整性错误：实体 "${sm.entity}" 未在 business_model.entities 中定义`);
          }
        }
        
        const smStates = new Set();
        if (checkType(sm.states, 'array', `${p}.states`)) {
          sm.states.forEach((s, j) => {
            if (checkType(s, 'string', `${p}.states[${j}]`)) {
              smStates.add(s);
            }
          });
        }
        
        if (checkType(sm.transitions, 'array', `${p}.transitions`)) {
          sm.transitions.forEach((t, j) => {
            const tp = `${p}.transitions[${j}]`;
            if (checkType(t, 'object', tp)) {
              if (checkType(t.from, 'string', `${tp}.from`) && !smStates.has(t.from)) {
                addError(`${tp}.from`, `状态机流转错误：起始状态 "${t.from}" 未在 states 列表中定义`);
              }
              if (checkType(t.to, 'string', `${tp}.to`) && !smStates.has(t.to)) {
                addError(`${tp}.to`, `状态机流转错误：目标状态 "${t.to}" 未在 states 列表中定义`);
              }
              checkType(t.trigger, 'string', `${tp}.trigger`);
              checkType(t.conditions, 'string', `${tp}.conditions`);

              // transitions.uiAction 校验
              if (t.uiAction) {
                if (!t.uiAction.buttonLabel) {
                  addWarning(`${tp}.uiAction.buttonLabel`, '缺失');
                }
                const validButtonTypes = ['primary', 'secondary', 'danger', 'ghost'];
                if (t.uiAction.buttonType && !validButtonTypes.includes(t.uiAction.buttonType)) {
                  addError(`${tp}.uiAction.buttonType`, `非法值: ${t.uiAction.buttonType}`);
                }
              }
            }
          });
        }
      }
    });
  }
  
  // 3.4 业务流程验证
  if (checkType(data.business_model.processes, 'array', 'business_model.processes')) {
    data.business_model.processes.forEach((proc, i) => {
      const p = `business_model.processes[${i}]`;
      if (checkType(proc, 'object', p)) {
        checkType(proc.name, 'string', `${p}.name`);
        const procTypes = ['main', 'branch', 'exception', 'approval'];
        if (!procTypes.includes(proc.type)) {
          addError(`${p}.type`, `业务流程类型错误: ${proc.type} (期望: ${procTypes.join('/')})`);
        }
        if (checkType(proc.steps, 'array', `${p}.steps`)) {
          proc.steps.forEach((s, j) => checkType(s, 'string', `${p}.steps[${j}]`));
        }
        if (checkType(proc.actors, 'array', `${p}.actors`)) {
          proc.actors.forEach((act, j) => {
            if (checkType(act, 'string', `${p}.actors[${j}]`)) {
              if (!rolesSet.has(act)) {
                addError(`${p}.actors[${j}]`, `引用完整性警告：角色 "${act}" 未在 business_context.roles 中定义`);
              }
            }
          });
        }

        // processes.uiMapping 校验
        if (proc.uiMapping) {
          if (!proc.uiMapping.pageId) {
            addWarning(`${p}.uiMapping.pageId`, '缺失');
          }
          if (!proc.uiMapping.stepToModule || !Array.isArray(proc.uiMapping.stepToModule)) {
            addWarning(`${p}.uiMapping.stepToModule`, '应为数组');
          }
        }
      }
    });
  }
  
  // 3.5 角色权限树验证
  if (checkType(data.business_model.roles, 'array', 'business_model.roles')) {
    data.business_model.roles.forEach((r, i) => {
      const p = `business_model.roles[${i}]`;
      if (checkType(r, 'object', p)) {
        if (checkType(r.name, 'string', `${p}.name`)) {
          rolesSet.add(r.name); // 补充可能在 business_model.roles 中定义的额外角色
        }
        checkType(r.description, 'string', `${p}.description`);
        if (checkType(r.permissions, 'array', `${p}.permissions`)) {
          r.permissions.forEach((perm, j) => checkType(perm, 'string', `${p}.permissions[${j}]`));
        }
      }
    });
  }
}

// 4. 验证 features
const featuresSet = new Set();
if (checkType(data.features, 'array', 'features')) {
  data.features.forEach((f, i) => {
    const p = `features[${i}]`;
    if (checkType(f, 'object', p)) {
      checkType(f.module, 'string', `${p}.module`);
      if (checkType(f.feature, 'string', `${p}.feature`)) {
        featuresSet.add(f.feature);
      }
      
      if (checkType(f.role, 'string', `${p}.role`)) {
        if (!rolesSet.has(f.role) && !SYSTEM_ROLES.has(f.role)) {
          addError(`${p}.role`, `引用完整性错误：功能所属角色 "${f.role}" 未在 roles 中定义`);
        }
      }
      
      const prioTypes = ['P0', 'P1', 'P2'];
      if (!prioTypes.includes(f.priority)) {
        addError(`${p}.priority`, `优先级类型错误: ${f.priority} (期望: ${prioTypes.join('/')})`);
      }
      checkType(f.user_story, 'string', `${p}.user_story`);
      
      if (checkType(f.acceptance_criteria, 'array', `${p}.acceptance_criteria`)) {
        f.acceptance_criteria.forEach((ac, j) => checkType(ac, 'string', `${p}.acceptance_criteria[${j}]`));
      }

      // features.interactionPatterns 校验
      if (f.interactionPatterns) {
        if (!Array.isArray(f.interactionPatterns)) {
          addError(`${p}.interactionPatterns`, '应为数组');
        }
      }

      // features.pageLayout 校验
      if (f.pageLayout) {
        const validPageTypes = ['list', 'detail', 'create', 'edit', 'approval', 'config', 'dashboard', 'log'];
        if (!validPageTypes.includes(f.pageLayout.pageType)) {
          addError(`${p}.pageLayout.pageType`, `非法值: ${f.pageLayout.pageType}`);
        }
        if (!f.pageLayout.modules || !Array.isArray(f.pageLayout.modules) || f.pageLayout.modules.length === 0) {
          addError(`${p}.pageLayout.modules`, '应为非空数组');
        }
      }
    }
  });
  
  // 深度依赖项校验 (第二轮，确认所有 dependencies 必须在 features 树中声明过)
  data.features.forEach((f, i) => {
    const p = `features[${i}]`;
    if (f && Array.isArray(f.dependencies)) {
      f.dependencies.forEach((dep, j) => {
        if (checkType(dep, 'string', `${p}.dependencies[${j}]`)) {
          if (!featuresSet.has(dep)) {
            addError(`${p}.dependencies[${j}]`, `引用完整性错误：依赖的功能 "${dep}" 未在 features 列表中声明`);
          }
        }
      });
    }
  });
}

// 5. 验证 feature_tree
if (checkType(data.feature_tree, 'object', 'feature_tree')) {
  checkType(data.feature_tree.text, 'string', 'feature_tree.text');
  
  if (checkType(data.feature_tree.modules, 'array', 'feature_tree.modules')) {
    data.feature_tree.modules.forEach((mod, i) => {
      const p = `feature_tree.modules[${i}]`;
      if (checkType(mod, 'object', p)) {
        checkType(mod.name, 'string', `${p}.name`);
        const prioTypes = ['P0', 'P1', 'P2'];
        if (!prioTypes.includes(mod.priority)) {
          addError(`${p}.priority`, `模块优先级类型错误: ${mod.priority}`);
        }
        
        if (checkType(mod.features, 'array', `${p}.features`)) {
          mod.features.forEach((f, j) => {
            const fp = `${p}.features[${j}]`;
            if (checkType(f, 'object', fp)) {
              if (checkType(f.name, 'string', `${fp}.name`)) {
                if (!featuresSet.has(f.name)) {
                  addError(`${fp}.name`, `结构一致性错误：树中功能 "${f.name}" 未在主 features 列表中定义`);
                }
              }
              if (!prioTypes.includes(f.priority)) {
                addError(`${fp}.priority`, `功能优先级类型错误: ${f.priority}`);
              }
            }
          });
        }
      }
    });
  }
}

// 6. 验证 risks
if (checkType(data.risks, 'array', 'risks')) {
  data.risks.forEach((risk, i) => {
    const p = `risks[${i}]`;
    if (checkType(risk, 'object', p)) {
      const levels = ['high', 'medium', 'low'];
      if (!levels.includes(risk.level)) {
        addError(`${p}.level`, `风险级别错误: ${risk.level}`);
      }
      checkType(risk.category, 'string', `${p}.category`);
      checkType(risk.description, 'string', `${p}.description`);
      checkType(risk.impact, 'string', `${p}.impact`);
      checkType(risk.suggestion, 'string', `${p}.suggestion`);
      checkType(risk.resolution, 'string', `${p}.resolution`);
    }
  });
}

// 7. 验证 missing_requirements
if (checkType(data.missing_requirements, 'array', 'missing_requirements')) {
  data.missing_requirements.forEach((req, i) => {
    const p = `missing_requirements[${i}]`;
    if (checkType(req, 'object', p)) {
      checkType(req.description, 'string', `${p}.description`);
      checkType(req.reason, 'string', `${p}.reason`);
      const prioTypes = ['P0', 'P1', 'P2'];
      if (!prioTypes.includes(req.priority)) {
        addError(`${p}.priority`, `优先级类型错误: ${req.priority}`);
      }
      const statuses = ['adopted', 'pending', 'rejected'];
      if (!statuses.includes(req.status)) {
        addError(`${p}.status`, `采纳状态错误: ${req.status}`);
      }
      const confTypes = ['high', 'medium', 'low'];
      if (!confTypes.includes(req.confidence)) {
        addError(`${p}.confidence`, `置信度类型错误: ${req.confidence}`);
      }
      
      // 一致性自检：如果是 adopted 的，必须在 features 中已出现
      if (req.status === 'adopted') {
        if (!isRequirementMatched(req.description, featuresSet)) {
          addError(`${p}.status`, `一致性校验错误：采纳的缺失需求 "${req.description}" 未在 features 清单中找到相匹配的功能项`);
        }
      }
    }
  });
}

// 8. 验证 system_design
if (checkType(data.system_design, 'object', 'system_design')) {
  
  if (checkType(data.system_design.data_model, 'array', 'system_design.data_model')) {
    data.system_design.data_model.forEach((tbl, i) => {
      const p = `system_design.data_model[${i}]`;
      if (checkType(tbl, 'object', p)) {
        checkType(tbl.table, 'string', `${p}.table`);
        checkType(tbl.description, 'string', `${p}.description`);
        if (checkType(tbl.key_fields, 'array', `${p}.key_fields`)) {
          tbl.key_fields.forEach((f, j) => checkType(f, 'string', `${p}.key_fields[${j}]`));
        }
      }
    });
  }
  
  if (checkType(data.system_design.api_design, 'array', 'system_design.api_design')) {
    data.system_design.api_design.forEach((api, i) => {
      const p = `system_design.api_design[${i}]`;
      if (checkType(api, 'object', p)) {
        checkType(api.method, 'string', `${p}.method`);
        checkType(api.path, 'string', `${p}.path`);
        checkType(api.description, 'string', `${p}.description`);
        if (checkType(api.actor, 'string', `${p}.actor`)) {
          if (!rolesSet.has(api.actor) && !SYSTEM_ROLES.has(api.actor)) {
            addError(`${p}.actor`, `引用完整性警告：API 调用角色 "${api.actor}" 未在 roles 中定义`);
          }
        }
      }
    });
  }
  
  if (checkType(data.system_design.integration, 'array', 'system_design.integration')) {
    data.system_design.integration.forEach((int, i) => {
      const p = `system_design.integration[${i}]`;
      if (checkType(int, 'object', p)) {
        checkType(int.system, 'string', `${p}.system`);
        const intTypes = ['sync', 'async', 'batch'];
        if (!intTypes.includes(int.type)) {
          addError(`${p}.type`, `集成方式错误: ${int.type} (期望: ${intTypes.join('/')})`);
        }
        checkType(int.description, 'string', `${p}.description`);
      }
    });
  }
  
  if (checkType(data.system_design.service_boundary, 'array', 'system_design.service_boundary')) {
    data.system_design.service_boundary.forEach((svc, i) => {
      const p = `system_design.service_boundary[${i}]`;
      if (checkType(svc, 'object', p)) {
        checkType(svc.service, 'string', `${p}.service`);
        checkType(svc.responsibility, 'string', `${p}.responsibility`);
        if (checkType(svc.dependencies, 'array', `${p}.dependencies`)) {
          svc.dependencies.forEach((dep, j) => checkType(dep, 'string', `${p}.dependencies[${j}]`));
        }
      }
    });
  }

  // 可选的 openapi_spec_yaml 校验
  if (data.system_design.openapi_spec_yaml !== undefined) {
    checkType(data.system_design.openapi_spec_yaml, 'string', 'system_design.openapi_spec_yaml');
  }
}

// 报告校验结果
if (warnings.length > 0) {
  console.warn(`\x1b[33m⚠️ 发现 ${warnings.length} 个警告：\x1b[0m`);
  warnings.forEach(w => console.warn(`  \x1b[33m- ${w}\x1b[0m`));
}

if (errors.length > 0) {
  console.error(`\x1b[31m❌ 校验失败！发现 ${errors.length} 个不符合规范的项：\x1b[0m`);
  errors.forEach(err => console.error(`  \x1b[33m- ${err}\x1b[0m`));
  process.exit(1);
} else {
  console.log('\x1b[32m🟢 Schema validation successful! 所有字段、枚举值和引用完整性校验通过。\x1b[0m');
  process.exit(0);
}
