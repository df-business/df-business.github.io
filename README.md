# df-business.github.io

dfer 的网页游戏试玩仓库，托管于 GitHub Pages。

在线访问：https://df-business.github.io/

## 目录结构

```
├── index.html          # 首页（游戏大厅）
├── 404.html            # 404 页面
└── games/              # 游戏目录，每个游戏一个子目录
    ├── 3d-grass-mower/          # 3D 割草无双
    ├── yiling-jianxian/        # 夷陵剑仙 Dora SSR 原版
    └── yiling-jianxian-threejs/ # 夷陵剑仙 Three.js 版
```

## 如何新增一个游戏

1. 在 `games/<游戏名>/` 下放置游戏文件（入口为 `index.html`）。
2. 在首页 `index.html` 的 `GAMES` 数组中新增配置，填写入口、封面、中文介绍、标签和目录实际字节数。
3. 提交并推送到 `2.x` 分支（GitHub Pages 的部署源分支）即可自动发布。

## 夷陵剑仙 Three.js 版

入口：https://df-business.github.io/games/yiling-jianxian-threejs/

源码维护于 `D:/three_js_project/yi_ling_jian_xian`。运行 `D:/three_js_project/itch-bundles/build-yiling.js` 生成压缩发布副本后，将 `yiling-jianxian-threejs-web/` 的内容同步至本仓库对应游戏目录；不要复制本地服务器、依赖目录或缓存。封面 `cover.png` 来自源码的 `Doc/submission-cover.png`。更新后重新统计游戏目录大小，并同步首页的 `bytes`。

## 作者

- 作者：dfer
- 邮箱：df_business@qq.com
- QQ：3504725309
- 网站：https://www.dfer.site
