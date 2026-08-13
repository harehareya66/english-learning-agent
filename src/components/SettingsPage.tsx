import { useState, useEffect, useCallback } from 'react';
import { 
  Form, 
  Input, 
  Textarea, 
  Button, 
  Tooltip,
  Popconfirm,
  MessagePlugin,
  Loading,
  Link,
  Tag,
  Select
} from 'tdesign-react';
import { 
  AddIcon, 
  EditIcon, 
  DeleteIcon,
  CheckIcon,
  CheckCircleFilledIcon,
  CloseCircleFilledIcon,
  RefreshIcon
} from 'tdesign-icons-react';
import { Bot, Sparkles, Code, FileText, Globe, Lightbulb, BookOpen, MessageCircle, AlertCircle, BarChart3, GraduationCap, Languages, Briefcase } from 'lucide-react';
import { CustomAgent } from '../types';

interface SettingsPageProps {
  agents: CustomAgent[];
  onAdd: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => CustomAgent;
  onUpdate: (id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}

interface AiConfigState {
  hasKey: boolean;
  checking: boolean;
  apiKeyMasked: string | null;
  model: string;
  baseUrl: string;
}

const PRESET_ICONS = [
  { name: 'Bot', icon: Bot },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Code', icon: Code },
  { name: 'FileText', icon: FileText },
  { name: 'Globe', icon: Globe },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'MessageCircle', icon: MessageCircle },
  { name: 'AlertCircle', icon: AlertCircle },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Languages', icon: Languages },
  { name: 'Briefcase', icon: Briefcase },
];

const PRESET_COLORS = [
  '#0052d9', '#0594fa', '#00a870', '#ed7b2f', 
  '#e34d59', '#a25eb5', '#5c6bc0', '#26a69a'
];

const PRESET_TEMPLATES = [
  {
    name: 'K12 同步辅导',
    description: '中小学英语同步教学，紧扣教材',
    systemPrompt: '你是一个专业的K12英语同步辅导老师，熟悉人教版、外研版等主流教材。你的职责是：\n1. 紧扣校内教材进度，同步讲解课文和词汇\n2. 用简单易懂的方式解释语法点\n3. 设计适合中小学生的练习题（图文联想、填空、选择等）\n4. 注重培养语感和学习兴趣\n5. 提供家长可监督的学习进度报告\n教学风格：亲切耐心，多用鼓励和游戏化元素，适合碎片化学习。',
    icon: 'GraduationCap',
    color: '#0594fa',
  },
  {
    name: '四六级/考研备考',
    description: '大学应试备考，精准提分',
    systemPrompt: '你是一个专业的大学英语考试备考助手，精通四六级、考研英语的考试规律和提分策略。你的职责是：\n1. 针对考试题型（阅读、听力、翻译、写作）提供专项训练\n2. 分析历年真题高频考点和出题规律\n3. 提供写作模板和高分句型\n4. 制定科学的备考时间表\n5. 模拟考试场景，提供限时练习\n教学风格：高效务实，注重技巧和策略，帮助用户在有限时间内最大化提分。',
    icon: 'FileText',
    color: '#00a870',
  },
  {
    name: '商务英语实战',
    description: '职场商务场景英语训练',
    systemPrompt: '你是一个专业的商务英语训练助手，专注于职场实战英语能力提升。你的职责是：\n1. 模拟商务场景对话（邮件、会议、谈判、汇报、面试等）\n2. 教授商务英语写作规范和常用句型\n3. 提供行业专业词汇（外贸、金融、IT、跨境电商等）\n4. 纠正中式英语表达，培养地道商务表达习惯\n5. 分享跨文化商务沟通技巧\n教学风格：专业务实，贴近真实职场需求，注重实际应用能力。',
    icon: 'Briefcase',
    color: '#ed7b2f',
  },
  {
    name: '雅思托福冲刺',
    description: '留学考试专项突破',
    systemPrompt: '你是一个专业的雅思/托福考试培训助手，深入了解考试评分标准和提分策略。你的职责是：\n1. 针对听说读写四项提供专项训练\n2. 提供口语话题卡练习和写作批改\n3. 教授考试技巧和时间管理策略\n4. 模拟真实考试环境，提供限时练习\n5. 根据目标分数制定个性化备考计划\n教学风格：针对性强，注重评分标准对标，帮助用户高效达成目标分数。',
    icon: 'Globe',
    color: '#a25eb5',
  },
];

export function SettingsPage({ 
  agents, 
  onAdd, 
  onUpdate, 
  onDelete 
}: SettingsPageProps) {
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    icon: 'Bot',
    color: '#0052d9',
  });
  
  // AI 配置状态
  const [aiConfig, setAiConfig] = useState<AiConfigState>({
    hasKey: false,
    checking: true,
    apiKeyMasked: null,
    model: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com',
  });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // 获取 AI 配置
  const fetchAiConfig = useCallback(async () => {
    setAiConfig(prev => ({ ...prev, checking: true }));
    try {
      const response = await fetch('/api/config/ai');
      const data = await response.json();
      setAiConfig({
        hasKey: data.hasKey,
        checking: false,
        apiKeyMasked: data.apiKeyMasked,
        model: data.model,
        baseUrl: data.baseUrl,
      });
    } catch {
      setAiConfig(prev => ({ ...prev, checking: false }));
    }
  }, []);

  // 保存 API Key
  const saveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      MessagePlugin.warning('请填写 API Key');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/config/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyInput.trim(),
          baseUrl: baseUrlInput.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        MessagePlugin.success('API Key 已保存');
        setApiKeyInput('');
        fetchAiConfig();
      } else {
        MessagePlugin.error(data.error || '保存失败');
      }
    } catch (error: any) {
      MessagePlugin.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 测试连接
  const testConnection = async () => {
    if (!apiKeyInput.trim()) {
      MessagePlugin.warning('请先填写 API Key');
      return;
    }
    setTesting(true);
    try {
      const response = await fetch('/api/config/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyInput.trim(),
          baseUrl: baseUrlInput.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (data.ok) MessagePlugin.success('连接成功，Key 有效');
      else MessagePlugin.error('连接失败：' + data.message);
    } catch (error: any) {
      MessagePlugin.error(error?.message || '测试失败');
    } finally {
      setTesting(false);
    }
  };

  // 清除 API Key
  const clearApiKey = async () => {
    await fetch('/api/config/ai', { method: 'DELETE' });
    MessagePlugin.success('已清除 API Key');
    fetchAiConfig();
  };

  // 初始化时获取配置
  useEffect(() => {
    fetchAiConfig();
  }, [fetchAiConfig]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      icon: 'Bot',
      color: '#0052d9',
    });
    setEditingAgent(null);
    setIsCreating(false);
  };

  const handleEdit = (agent: CustomAgent) => {
    if (['default', 'vocabulary', 'oral-practice', 'error-review', 'assessment'].includes(agent.id)) return;
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      systemPrompt: agent.systemPrompt,
      icon: agent.icon || 'Bot',
      color: agent.color || '#0052d9',
    });
    setIsCreating(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      MessagePlugin.warning('请填写名称和系统提示词');
      return;
    }

    if (editingAgent) {
      onUpdate(editingAgent.id, formData);
      MessagePlugin.success('Agent 已更新');
    } else {
      onAdd(formData);
      MessagePlugin.success('Agent 已创建');
    }
    resetForm();
  };

  const handleUseTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setFormData({
      ...template,
      description: template.description,
    });
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    MessagePlugin.success('Agent 已删除');
  };

  const getIconComponent = (iconName: string) => {
    const preset = PRESET_ICONS.find(p => p.name === iconName);
    return preset ? preset.icon : Bot;
  };

  const customAgents = agents.filter(a => !['default', 'vocabulary', 'oral-practice', 'error-review', 'assessment'].includes(a.id));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div>
          <h1 
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            设置
          </h1>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            管理登录配置和英语学习 Agent
          </p>
        </div>

        {/* API Key 配置 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 
                className="text-lg font-medium"
                style={{ color: 'var(--td-text-color-primary)' }}
              >
                API Key 配置
              </h2>
              <p 
                className="text-sm mt-1"
                style={{ color: 'var(--td-text-color-secondary)' }}
              >
                填入你的 DeepSeek API Key，启用 AI 增强功能；未配置时自动使用本地模式（词根词源 / 复习 / 测评均可离线使用）
              </p>
            </div>
            <Button 
              variant="text" 
              icon={<RefreshIcon />}
              onClick={fetchAiConfig}
              loading={aiConfig.checking}
            >
              刷新
            </Button>
          </div>

          {/* 当前状态 */}
          <div className="flex items-center gap-3 mb-6">
            {aiConfig.checking ? (
              <>
                <Loading size="small" />
                <span style={{ color: 'var(--td-text-color-secondary)' }}>
                  正在读取配置...
                </span>
              </>
            ) : aiConfig.hasKey ? (
              <>
                <CheckCircleFilledIcon 
                  size="20px" 
                  style={{ color: 'var(--td-success-color)' }} 
                />
                <span style={{ color: 'var(--td-text-color-primary)' }}>
                  已配置
                </span>
                <Tag size="small" variant="outline">
                  {aiConfig.model}
                </Tag>
                {aiConfig.apiKeyMasked && (
                  <span 
                    className="text-sm font-mono"
                    style={{ color: 'var(--td-text-color-secondary)' }}
                  >
                    {aiConfig.apiKeyMasked}
                  </span>
                )}
              </>
            ) : (
              <>
                <CloseCircleFilledIcon 
                  size="20px" 
                  style={{ color: 'var(--td-text-color-placeholder)' }} 
                />
                <span style={{ color: 'var(--td-text-color-secondary)' }}>
                  未配置（本地模式）
                </span>
              </>
            )}
          </div>

          {/* 配置表单 */}
          <div className="space-y-3">
            <div>
              <label 
                className="text-xs block mb-1"
                style={{ color: 'var(--td-text-color-placeholder)' }}
              >
                DeepSeek API Key
              </label>
              <Input
                type="password"
                value={apiKeyInput}
                onChange={(v) => setApiKeyInput(v as string)}
                placeholder="sk-..."
              />
            </div>
            <div>
              <label 
                className="text-xs block mb-1"
                style={{ color: 'var(--td-text-color-placeholder)' }}
              >
                Base URL（可选，默认官方接口）
              </label>
              <Input
                value={baseUrlInput}
                onChange={(v) => setBaseUrlInput(v as string)}
                placeholder="https://api.deepseek.com"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button 
                theme="primary" 
                onClick={saveApiKey}
                loading={saving}
              >
                保存
              </Button>
              <Button 
                variant="outline" 
                onClick={testConnection}
                loading={testing}
              >
                测试连接
              </Button>
              {aiConfig.hasKey && (
                <Button 
                  variant="text" 
                  onClick={clearApiKey}
                >
                  清除
                </Button>
              )}
            </div>
          </div>
        </div>

        <div 
          style={{ 
            height: '1px', 
            backgroundColor: 'var(--td-component-border)' 
          }} 
        />

        {/* Agent 配置 */}
        <div>
          <div className="mb-4">
            <h2 
              className="text-lg font-medium"
              style={{ color: 'var(--td-text-color-primary)' }}
            >
              Agent 配置
            </h2>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              创建和管理英语学习 Agent
            </p>
          </div>

          <div className="space-y-6">
              {/* 创建/编辑表单 */}
              {isCreating ? (
                <div 
                  className="p-5 rounded-xl border"
                  style={{ 
                    backgroundColor: 'var(--td-bg-color-container)',
                    borderColor: 'var(--td-component-border)'
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-base font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                        {editingAgent ? '编辑 Agent' : '创建新 Agent'}
                      </h4>
                      <Button variant="text" onClick={resetForm}>取消</Button>
                    </div>
                    
                    <Form labelAlign="top">
                      <Form.FormItem label="名称" requiredMark>
                        <Input 
                          value={formData.name}
                          onChange={(v) => setFormData(prev => ({ ...prev, name: v as string }))}
                          placeholder="例如：代码助手"
                        />
                      </Form.FormItem>
                      
                      <Form.FormItem label="描述">
                        <Input 
                          value={formData.description}
                          onChange={(v) => setFormData(prev => ({ ...prev, description: v as string }))}
                          placeholder="简短描述这个 Agent 的用途"
                        />
                      </Form.FormItem>
                      
                      <Form.FormItem label="图标和颜色">
                        <div className="flex gap-4">
                          <div className="flex gap-2">
                            {PRESET_ICONS.map(({ name, icon: Icon }) => (
                              <button
                                key={name}
                                type="button"
                                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2"
                                style={{
                                  backgroundColor: formData.icon === name ? formData.color : 'transparent',
                                  color: formData.icon === name ? 'white' : 'var(--td-text-color-secondary)',
                                  borderColor: formData.icon === name ? formData.color : 'var(--td-component-border)',
                                }}
                                onClick={() => setFormData(prev => ({ ...prev, icon: name }))}
                              >
                                <Icon size={18} />
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1.5 items-center">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                style={{ backgroundColor: color }}
                                onClick={() => setFormData(prev => ({ ...prev, color }))}
                              >
                                {formData.color === color && <CheckIcon style={{ color: 'white' }} size="14px" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </Form.FormItem>
                      
                      <Form.FormItem label="系统提示词" requiredMark>
                        <Textarea 
                          value={formData.systemPrompt}
                          onChange={(v) => setFormData(prev => ({ ...prev, systemPrompt: v as string }))}
                          placeholder="定义 Agent 的行为和能力..."
                          autosize={{ minRows: 4, maxRows: 8 }}
                        />
                      </Form.FormItem>
                    </Form>
                    
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={resetForm}>取消</Button>
                      <Button theme="primary" onClick={handleSave}>
                        {editingAgent ? '保存修改' : '创建 Agent'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 预设学习模式 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
                      预设学习模式（内置）
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {agents.filter(a => ['default', 'vocabulary', 'oral-practice', 'error-review', 'assessment'].includes(a.id)).map(agent => {
                        const Icon = getIconComponent(agent.icon || 'Bot');
                        return (
                          <div 
                            key={agent.id} 
                            className="p-3 rounded-lg"
                            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: agent.color || '#0052d9' }}
                              >
                                <Icon size={20} color="white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                                  {agent.name}
                                </div>
                                <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                  {agent.description || agent.systemPrompt.slice(0, 50) + '...'}
                                </div>
                              </div>
                              <Tag size="small" variant="light-outline" theme="primary">
                                内置
                              </Tag>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 快速创建 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
                      快速创建
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {PRESET_TEMPLATES.map(template => {
                        const Icon = getIconComponent(template.icon);
                        return (
                          <div 
                            key={template.name} 
                            className="p-3 rounded-lg cursor-pointer transition-all hover:shadow-md"
                            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                            onClick={() => handleUseTemplate(template)}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: template.color }}
                              >
                                <Icon size={20} color="white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate" style={{ color: 'var(--td-text-color-primary)' }}>
                                  {template.name}
                                </div>
                                <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                  {template.description}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 自定义创建按钮 */}
                  <Button 
                    icon={<AddIcon />} 
                    variant="dashed" 
                    block 
                    onClick={() => setIsCreating(true)}
                  >
                    从头创建 Agent
                  </Button>

                  {/* 已有的自定义 Agent */}
                  {customAgents.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
                        我的 Agent ({customAgents.length})
                      </h4>
                      <div className="space-y-2">
                        {customAgents.map(agent => {
                          const Icon = getIconComponent(agent.icon || 'Bot');
                          return (
                            <div 
                              key={agent.id} 
                              className="p-3 rounded-lg"
                              style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: agent.color || '#0052d9' }}
                                >
                                  <Icon size={20} color="white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                                    {agent.name}
                                  </div>
                                  <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                    {agent.description || agent.systemPrompt.slice(0, 50) + '...'}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Tooltip content="编辑">
                                    <Button 
                                      variant="text" 
                                      shape="circle" 
                                      size="small"
                                      icon={<EditIcon />}
                                      onClick={() => handleEdit(agent)}
                                    />
                                  </Tooltip>
                                  <Popconfirm
                                    content="确定删除这个 Agent 吗？"
                                    onConfirm={() => handleDelete(agent.id)}
                                  >
                                    <Tooltip content="删除">
                                      <Button 
                                        variant="text" 
                                        shape="circle" 
                                        size="small"
                                        icon={<DeleteIcon />}
                                      />
                                    </Tooltip>
                                  </Popconfirm>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
