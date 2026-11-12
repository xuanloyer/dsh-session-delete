# dsh-session-delete

在 DeepSeek Harness 侧边栏里**永久删除**会话，而不只是归档。

DeepSeek Harness 的会话是 append-only 日志，官方只提供**归档**：持久化层没有删除接口，
Workspace 也把"删除会话"明确列为不具备的能力。这个 bundle 把缺失的动作加进会话行菜单。

## 环境要求

- DeepSeek Harness `0.2.2-rc.1`（通过 `engines.dsh` 校验），Web GUI 通过 `http://` 访问。
- 一个受管理的 profile（本包是 bundle，需通过插件管理器安装）。

## 安装

**Web 界面** —— 打开 **Plugins → Add plugin**，填入本仓库的 Git 地址：

```
https://github.com/xuanloyer/dsh-session-delete
```

**命令行** —— 在拥有该 profile 的安装里执行：

```
dsh plugin --profile <profile> add https://github.com/xuanloyer/dsh-session-delete
```

**本地开发** —— 直接指向本目录：

```
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-delete
```

Git 源会记录安装时的 commit。升级需要先卸载再安装，Plugins 页面对 Git 源不提供原地升级。

## 使用

1. 鼠标悬停到左侧会话行，打开 **…** 菜单。
2. 选择 **删除会话…**。
3. 在确认框里点 **删除**。会话行消失，日志删除完成后页面自动刷新。

会话有运行中的工作时（进行中的对话、子代理、后台任务、定时任务）会被拒绝，并列出这些工作；
先停止它们再删除。

## 工作原理

Host 端执行三步：

1. 通过 `ctx.workspaceRegistry.archiveSession()` **归档**该会话：行立即从侧边栏消失，归档 gate
   会拒绝该会话之后的模型步骤，日志因此静止。
2. **删除它的日志文件**——`session*.jsonl`、`session*.jsonl.zstd` 和 `session.lock`——只在该会话
   自己的目录内。目录布局取自官方 JSONL 后端的文档：`<root>/--<规范化 cwd>--/<会话 id>/` 或
   `<root>/_no-cwd/<会话 id>/`。目录里其他文件不动；目录结构不符时直接失败，不做猜测。
3. **删除空出来的会话目录。**

浏览器端是一个 Client module：它贡献菜单项和确认对话框，并通过
`POST /dsh-plugin/session-delete` 调用 Host。Client module 通道没有生成的 Remote 命名空间，
所以这里是包私有的同源桥；它只接受同源、`application/json` 的 `POST`。

该操作只对用户开放：本 bundle 不注册 Agent 工具，模型无法删除用户的会话——这与 DeepSeek Harness
把归档、重命名、fork 只开放给用户的做法一致。

## 限制

- **只删日志文件。** 附件存放在内容寻址的共享存储里，不会删除；派生投影缓存会留下（会话没了之后
  它们是惰性的）。全文搜索索引会在下次检索时按持久化源自动对账。
- **先归档**，因此已删除会话的 id 会留在 profile 的归档集合里：不可达、不可见，工作区成员关系会在
  下一次变更或重启时清理。
- **运行中的工作会阻止删除**：对话、子代理、后台任务、定时任务必须先停止。
- **会校验存储布局。** 如果未来版本改变了会话目录布局，操作会拒绝执行，而不是删错文件。
- **仅支持 Web GUI。** Desktop 的 `file://` 外壳访问不到这个 HTTP 桥，对话框会明确报错。
- **删除成功后页面会刷新**，其他会话里未发送的草稿会丢失。
- 基于 `0.2.2-rc.1` 在 Windows 上开发与验证；其他平台遵循同样的目录布局，但未做额外测试。

## 隐私

全部操作都在本地完成：不做网络请求，不上报遥测，只读取该操作目标的 profile 会话存储。

## 开发

没有构建步骤：`client.js` 是原样下发的普通 Client module，`index.js` 是 Host 端。改完文件重新安装
bundle、刷新页面即可。

```
node --check index.js
node --check client.js   # 仅语法检查；该文件使用浏览器全局
pnpm pack                # 查看实际打包内容，不发布
```

## 卸载

**Plugins → Installed plugins → dsh-session-delete → Remove**，或：

```
dsh plugin --profile <profile> remove dsh-session-delete
```

卸载会移除菜单项和 HTTP 路由。已删除的会话保持删除状态，其余会话不受影响。

## 许可证

MIT，见 [LICENSE](LICENSE)。
