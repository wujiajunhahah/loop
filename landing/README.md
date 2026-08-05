# 「我在」Landing Page

这是 [www.wozai.space](https://www.wozai.space/) 的官方网站源码，也是外界理解「我在」产品定位、关系托付方式与 AI 边界的首要入口。

官网当前包含中英双语产品叙事、46 秒 AI 概念短片、使用路径、未来接收体验、产品原则、FAQ 与首批共创订阅。概念短片用于表达母女、信鸽和记忆托付的愿景，页面已明确说明它不是功能 Demo。

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
├── en/                 # 英文首页与英文订阅结果页
├── language.js         # 设备语言识别、语言路由与偏好保存
├── styles.css          # 响应式视觉与动画
├── script.js           # 导航、滚动显现、邮箱订阅表单
├── subscribed.html     # 双语订阅成功与异常状态页
├── subscription.css    # 订阅结果页样式
├── subscription-result.js # 订阅结果状态文案
├── api/
│   ├── subscribe.js    # 按界面语言发送 24 小时有效的订阅确认邮件
│   └── confirm-subscription.js # 确认后写入 Resend Contacts
├── assets/             # Logo、信鸽、favicon、分享图与概念短片
│   └── video/          # H.264 MP4 与视频 poster
├── robots.txt          # 爬虫规则与 sitemap 地址
├── sitemap.xml         # 搜索引擎页面清单
├── llms.txt            # 面向生成式搜索的品牌事实与边界
├── site.webmanifest    # Web App 名称、颜色与图标
├── package.json        # 将 Vercel Functions 固定为 CommonJS 运行模式
├── .env.example        # 环境变量名称；不包含真实密钥
└── vercel.json         # 部署、缓存和安全响应头
```

## 内容更新

- 页面文案与 FAQ：修改 `index.html`。
- 英文页面：同步修改 `en/index.html`；语言选择会保存在浏览器本地存储与 Cookie 中。
- 颜色、排版和响应式：修改 `styles.css` 顶部变量及对应组件。
- 邮件订阅：共创叙事区内只收集邮箱；`api/subscribe.js` 先按用户当前界面语言发送带 Logo 的精简确认邮件，用户点击后由 `api/confirm-subscription.js` 写入 Resend Contacts，并向首次确认者发送双语欢迎邮件。
- 订阅结果：确认成功跳转到 `/subscribed`；过期、无效或服务异常也由同一页面提供双语提示和重新订阅入口。
- 品牌主视觉：优先使用 `assets/brand-bird-logo.webp`；透明高质量源为 `assets/brand-bird-logo.png`。
- 概念短片：网页使用 `assets/video/wozai-concept-film.mp4`，封面为同目录 poster；短片必须继续标注为 AI 概念内容，不能写成功能录屏。
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

## 维护附录：上线配置

Vercel 项目 `geekthon/loop` 的 Root Directory 必须保持为 `landing`，Framework Preset 为 `Other`。生产分支为 GitHub 仓库 `wujiajunhahah/loop` 的 `main`。

推送 `main` 后 Vercel 会自动创建生产部署。部署成功后检查：

```bash
curl -I https://www.wozai.space/
curl -I https://www.wozai.space/robots.txt
curl -I https://www.wozai.space/sitemap.xml
curl -I https://www.wozai.space/llms.txt
```

裸域名 `https://wozai.space/` 应跳转到 `https://www.wozai.space/`。

### 环境变量

生产环境必须配置：

```dotenv
RESEND_API_KEY=re_xxxxxxxxx
```

可选变量见 [`.env.example`](./.env.example)：

- `RESEND_FROM_EMAIL`：发件人，默认 `我在 <hello@wozai.space>`。
- `SITE_URL`：可选的确认链接固定域名；未配置时使用当前部署的请求域名。
- `SUBSCRIBE_TOKEN_SECRET`：订阅确认链接签名密钥；建议独立配置。
- `RESEND_SEGMENT_ID`、`RESEND_TOPIC_ID`：可选的 Resend 分组与订阅主题。

真实密钥只放在 Vercel Environment Variables，不得写入代码、`.env.example`、README 或 Git 历史。

### 表单数据流

```text
订阅邮箱 → /api/subscribe → 24 小时确认邮件
         → /api/confirm-subscription → Resend Contacts + 官网订阅 Segment
                                     → 首次确认欢迎邮件 + /subscribed 成功页
```

只有用户勾选订阅授权、提交邮箱并点击 24 小时内有效的确认链接后，邮箱才会进入 Resend Contacts 与官网订阅 Segment。

## 当前限制

- Subscribe 使用 24 小时有效的双重确认；后续 Broadcast 应保留 Resend 退订入口。
- 确认邮件、欢迎邮件与成功页使用 `assets/brand-symbol-email.png`；源 Logo 保留为 `brand-symbol-dark.svg` / `brand-symbol-light.svg`。
- SEO/GEO 配置不能保证排名或引用；仍需要站长平台提交、持续发布高质量内容和获得可信外部提及。
- 上线前应确认 `hello@wozai.space` 邮箱可以正常收信。
