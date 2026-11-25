# Zelo 正式品牌资产

负责人定稿：39 号极简写实蜗牛，品牌名称 Zelo。9 枚原始 SVG 来自负责人提供的 `rental-OS/assets/01_Logo/zelo-logo-bw/`，以独立副本接入本仓库；上游不参与构建或运行。

- `zelo-logo-{black,white}.svg`：横版组合标，704 × 236。
- `zelo-icon-{black,white}.svg`：独立图形，512 × 512。
- `zelo-wordmark-{black,white}.svg`：矢量字标，444 × 220。
- `zelo-favicon.svg`：随浏览器配色切换的图形标，512 × 512。
- `zelo-badge-{black,white}.svg`：应用徽章，512 × 512。

全部使用矢量路径，无位图及外部字体依赖。`source-hashes.json` 记录原稿 SHA-256；此目录的原稿不执行格式整理。

静态入口使用 `BrandIcon` 和 `BrandWordmark`；纯黑 SVG 在深色容器反白。字标右侧的描边 `pre` 标签由 HTML/CSS 提供，不写入这些 SVG 原稿。轻量启动和 React 开场共用包含标签的字标槽位，整体居中、显现及归位。

开场通过 `brand-artwork.ts` 读取同一份路径，将填充映射为当前黑白色并添加变换组，原 path 全程不变。2200ms 一次性的“赛车蜗牛”开场从右侧滑入，整体甩尾刹停，短暂停顿后仅一次向后蓄势，头部转向左上角真实导航目标再加速前冲，冲刺期间保持目标朝向，抵达后才转回正常朝左姿态，并带短速度拖线。动效只使用整体位移、旋转与等比缩放，不连续蠕动、不叠加触角动作、不循环；不修改本目录原稿。字标与 `pre` 全程保持水平，不随蜗牛转向，一起显现和归位。

首页环绕区继续独立随滚动进度整体轻探，停滚保持、反向恢复，不重播开场时间轴。跳过、Escape 及减少动态效果直接使用静态标志。

浏览器继续使用既有 `/brand/platform-icon.svg` 路径，其内容与 `zelo-favicon.svg` 相同。README 使用原始黑白组合标。品牌展示保留内部包名、API、环境变量与存储键兼容；当前平台仓库为 `JinPen-G/Zelo-pre`。
