# df-business.github.io

dfer 的网页游戏试玩仓库，托管于 GitHub Pages。

在线访问：https://df-business.github.io/

## 目录结构

```
├── index.html          # 首页（游戏大厅）
├── 404.html            # 404 页面
└── games/              # 游戏目录，每个游戏一个子目录
    └── 3d-grass-mower/ # 3D 割草无双
```

## 如何新增一个游戏

1. 在 `games/<游戏名>/` 下放置游戏文件（入口为 `index.html`）。
2. 在首页 `index.html` 的 `.grid` 中新增一张 `<a class="game">` 卡片，`href` 指向 `games/<游戏名>/`。
3. 提交并推送到 `2.x` 分支（GitHub Pages 的部署源分支）即可自动发布。

## 作者

- 作者：dfer
- 邮箱：df_business@qq.com
- QQ：3504725309
- 网站：https://www.dfer.site