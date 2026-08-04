# 「我在」Landing Page

这是 [www.wozai.space](https://www.wozai.space/) 的生产环境静态官网。目录本身可直接部署，不依赖 Node.js、构建工具或后端服务。

## 本地预览

```bash
cd landing
python3 -m http.server 4173
```

打开 [http://localhost:4173](http://localhost:4173)。

## 文件说明

```text
landing/
├── index.html          # 页面内容、meta、JSON-LD
├── styles.css          # 响应式视觉与动画
├── script.js           # 导航、滚动显现、邮件联系表单
├── assets/             # Logo、信鸽、favicon、分享图
├── robots.txt          # 爬虫规则与 sitemap 地址
├── sitemap.xml         # 搜索引擎页面清单
├── llms.txt            # 面向生成式搜索的品牌事实与边界
├── site.webmanifest    # Web App 名称、颜色与图标
└── vercel.json         # 静态部署、缓存和安全响应头
```

## 内容更新

- 页面文案与 FAQ：修改 `index.html`。
- 颜色、排版和响应式：修改 `styles.css` 顶部变量及对应组件。
- 联系交互：修改 `script.js`；当前表单打开用户的默认邮件客户端，收件地址为 `hello@wozai.space`。
- 品牌主视觉：优先使用 `assets/brand-bird-logo.webp`；透明高质量源为 `assets/brand-bird-logo.png`。
- 分享图：更新 `assets/og-cover.png` 后，同时核对 `index.html` 中的 Open Graph 和 Twitter Card 地址。

如果修改品牌定位、域名、邮箱或 FAQ，请同步检查 `index.html` 的可见内容与 JSON-LD、`llms.txt`、`sitemap.xml` 和本 README，确保机器可读信息与页面正文一致。

## SEO / GEO 检查清单

- 页面只有一个清晰的 H1，标题层级连续。
- `title`、description、canonical、Open Graph 与 Twitter Card 信息准确。
- `Organization`、`WebSite`、`FAQPage` JSON-LD 可解析，内容与正文一致。
- 所有有意义的图片都有准确的 `alt`；装饰图片使用空 `alt` 或隐藏语义。
- `robots.txt`、`sitemap.xml`、`llms.txt` 均返回 `200`。
- 站内正式 URL 统一使用 `https://www.wozai.space/`。
- 移动端 360 px 宽度无横向滚动，键盘可操作导航与表单。

## 部署

Vercel 项目 `geekthon/loop` 的 Root Directory 必须保持为 `landing`，Framework Preset 为 `Other`。生产分支为 GitHub 仓库 `wujiajunhahah/loop` 的 `main`。

推送 `main` 后 Vercel 会自动创建生产部署。部署成功后检查：

```bash
curl -I https://www.wozai.space/
curl -I https://www.wozai.space/robots.txt
curl -I https://www.wozai.space/sitemap.xml
curl -I https://www.wozai.space/llms.txt
```

裸域名 `https://wozai.space/` 应跳转到 `https://www.wozai.space/`。

## 当前限制

- 共创表单依赖本机邮件客户端，不会向服务器提交或持久化数据。
- SEO/GEO 配置不能保证排名或引用；仍需要站长平台提交、持续发布高质量内容和获得可信外部提及。
- 上线前应确认 `hello@wozai.space` 邮箱可以正常收信。

