# 小食堂 · 校园便捷就餐平台

河北地质大学校园就餐服务网站——查看食堂实时拥挤度、今日菜单、预约点餐、空座查询、食堂导航。

- 📱 手机优先自适应（移动端体验类似小程序），电脑浏览器同样适配
- 🌐 部署于 GitHub Pages，免安装、浏览器直接打开
- 📦 纯 HTML/CSS/JS，无构建步骤、无后端

## 目录结构

```
xiaoshitang/
├── index.html          # 单页应用入口
├── css/style.css       # 全部样式
├── js/                 # 前端逻辑
├── data/               # 生成的数据（canteens/windows/dishes/qinghe/map）
├── tools/build_data.py # 数据生成脚本（从参考站抓取→生成 JSON）
└── STATUS.md           # 项目进度状态
```

## 数据说明

- 食堂/档口/菜品数据来自河北地质大学「河地大几何地图」公开接口（map.hgu.life），共 6 个食堂、156 个档口、2389 道菜品
- 人流、空座、今日菜单等动态数据由前端模拟（静态托管无后端）
- 数据更新：运行 `python tools/build_data.py`（原始数据缓存在 `E:/vibe/.research/`）
