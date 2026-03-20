# 採用管理システム (ATS - Applicant Tracking System)

ジョブカンライクな採用管理システムです。Python標準ライブラリのみで動作し、外部パッケージのインストールは不要です。

## 機能一覧

| 機能 | 説明 |
|------|------|
| ダッシュボード | 求人数・候補者数・面接予定・採用数のサマリー、最近のアクティビティ |
| 求人管理 | 求人の作成・編集・公開・クローズ、部署/雇用形態フィルタ |
| 候補者管理 | 候補者情報の登録・編集・検索、応募履歴の管理 |
| 選考パイプライン | カンバンボード形式の選考フロー管理（応募→書類選考→一次面接→二次面接→最終面接→内定→採用） |
| 面接管理 | 面接スケジュールの作成・管理、カレンダー/リスト表示切替 |
| 評価シート | 5段階評価（技術力・コミュニケーション・カルチャーフィット・モチベーション）、コメント・推薦 |
| レポート | 採用ファネル、応募経路分析、部署別統計、採用期間分析 |
| 設定 | 部署管理、選考ステージカスタマイズ |

## クイックスタート

```bash
# リポジトリをクローン
git clone https://github.com/YOUR_USERNAME/ats-system.git
cd ats-system

# 起動（Python 3.8以上が必要）
python3 app.py

# ブラウザで開く
# http://localhost:8080
```

初回起動時にデモデータが自動で投入されます。

## 技術スタック

- **バックエンド**: Python 3 標準ライブラリ（http.server, sqlite3, json）
- **フロントエンド**: HTML / CSS / JavaScript（フレームワーク不使用）
- **データベース**: SQLite（ファイルベース、設定不要）

## プロジェクト構成

```
ats-system/
├── app.py              # エントリーポイント
├── server.py           # HTTPサーバー・ルーター
├── database.py         # DB初期化・シードデータ
├── api/                # REST APIモジュール
│   ├── jobs.py         # 求人API
│   ├── candidates.py   # 候補者API
│   ├── applications.py # 応募API
│   ├── interviews.py   # 面接API
│   ├── evaluations.py  # 評価API
│   ├── activities.py   # アクティビティAPI
│   └── reports.py      # レポートAPI
├── static/             # フロントエンド
│   ├── index.html      # SPA シェル
│   ├── css/style.css   # スタイルシート
│   └── js/             # JavaScript モジュール
│       ├── app.js      # コアルーター・ユーティリティ
│       ├── dashboard.js
│       ├── jobs.js
│       ├── candidates.js
│       ├── pipeline.js
│       ├── interviews.js
│       ├── evaluations.js
│       ├── reports.js
│       └── settings.js
└── README.md
```

## API エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET/POST | `/api/jobs` | 求人一覧取得 / 新規作成 |
| GET/PUT/DELETE | `/api/jobs/:id` | 求人詳細 / 更新 / 削除 |
| GET/POST | `/api/candidates` | 候補者一覧 / 新規登録 |
| GET/PUT/DELETE | `/api/candidates/:id` | 候補者詳細 / 更新 / 削除 |
| GET/POST | `/api/applications` | 応募一覧 / 新規応募 |
| PATCH | `/api/applications/:id/stage` | 選考ステージ変更 |
| GET/POST | `/api/interviews` | 面接一覧 / スケジュール作成 |
| GET/POST | `/api/evaluations` | 評価一覧 / 評価登録 |
| GET | `/api/reports/summary` | サマリーレポート |
| GET | `/api/reports/pipeline` | パイプラインレポート |
| GET | `/api/activities` | アクティビティ履歴 |

## ライセンス

MIT
