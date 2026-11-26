# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Chrome 浏览器扩展（Cookie 管理器），用于管理浏览器的 Cookie。支持查看、添加、编辑、删除、导入和导出 Cookie 功能。

- 扩展类型：Chrome Extension Manifest V3
- 技术栈：原生 JavaScript（无框架）
- 界面：Popup 弹出窗口（popup.html + popup.css + popup-main.js）

## 开发调试

### 加载扩展（开发者模式）

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本扩展所在的文件夹
5. 扩展图标将出现在浏览器工具栏中

### 重新加载

修改代码后，在 `chrome://extensions/` 页面点击扩展卡片的刷新按钮，或点击「重新加载」按钮。

## 文件结构

```
cookie-identify-manager/
├── manifest.json      # 扩展配置（Manifest V3）
├── popup.html         # 弹出窗口 HTML 结构
├── popup.css          # 样式文件
├── popup-main.js      # 主要逻辑代码
└── icons/             # 图标资源
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 架构说明

### 状态管理（popup-main.js）

全局状态对象 `state` 位于第 9-29 行：

```javascript
const state = {
  cookies: [],           // 所有 Cookie 列表
  filteredCookies: [],   // 过滤后的 Cookie 列表
  currentDomain: '',     // 当前域名
  baseDomain: '',        // 基础域名（二级域名）
  domainMode: 'exact',   // 域名模式：exact(精确) | base(基础域名)
  searchKeyword: '',     // 搜索关键字
  filters: { httpOnly: false, secure: false, session: 'all' },  // session: 'all' | 'session' | 'persistent'
  sort: { field: 'name', order: 'asc' },
  selectedCookie: null,  // 当前选中的 Cookie
  exportFormat: 'json',  // 导出格式：json | header | netscape
  headerLineBreak: false,// Header String 格式是否换行
  jsonCompress: false    // JSON 格式是否压缩
};
```

### 导入导出格式

支持三种格式：
- **JSON**：完整 Cookie 对象数组，支持压缩/格式化选项
- **Header String**：`name1=value1; name2=value2` 格式，支持换行分隔选项
- **Netscape**：制表符分隔的标准格式

导出功能支持两种输出方式：
- **复制到剪贴板**：将导出内容复制到系统剪贴板
- **下载文件**：生成带域名和时间戳的文件（如 `example.com_2025-03-20-14-30-00.json`）

### Cookie API 关键细节

- **删除 Cookie**：使用 `chrome.cookies.remove({ url, name })`，不需要 domain 或 path
- **构建 URL**：`http://` + 域名（去除前导点）+ path
- **编辑 Cookie**：先删除旧 Cookie，再创建新 Cookie
- **查询 Cookie**：使用 `chrome.cookies.getAll({ domain })`

### 列宽拖拽功能

列表头部支持拖拽调整列宽（popup-main.js 第 50-104 行）：
- 通过 `.resizer` 元素实现拖拽手柄
- 拖拽时同步更新表头和所有数据行的列宽
- 最小宽度限制为 30px

## 权限说明

扩展需要以下权限（定义在 manifest.json）：
- `cookies`：读取和修改 Cookie
- `activeTab`：获取当前标签页信息
- `clipboardWrite`：复制数据到剪贴板
- `storage`：存储用户设置（预留）
- `<all_urls>`：访问所有 URL 的 Cookie

## 兼容性

- Chrome 88+ (Manifest V3)
- Edge 88+ (基于 Chromium)
- 其他基于 Chromium 的浏览器
