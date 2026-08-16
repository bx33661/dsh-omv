# 测试目录

所有 Vitest 测试集中在这里，生产源码保持在 `src/`。

- `config.test.ts`：Cordis 配置边界
- `http.test.ts`：HTTP/SSE 桥接
- `service.test.ts` / `runtime.test.ts`：原生 DSH Service 与运行时诊断
- `workbench.test.ts`：工作区聚合、Action 和监听器
- `collaboration.test.ts` / `dedup.test.ts` / `reporting.test.ts`：领域服务持久化
- `settings.test.ts`：用户设置合同

运行：

```bash
npm test
```
