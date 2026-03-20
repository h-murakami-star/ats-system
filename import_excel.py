#!/usr/bin/env python3
"""
Excelファイルからデータをインポートするスクリプト
Usage: python3 import_excel.py <excel_file>
"""

import sys
import sqlite3
import pandas as pd
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "ats.db"


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def clean_name(name):
    """名前から「様」を除去"""
    if not name or not isinstance(name, str):
        return name
    return name.replace('様', '').strip()


def parse_date(val):
    """日付をISO文字列に変換"""
    if pd.isna(val):
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    try:
        return pd.to_datetime(val).isoformat()
    except:
        return None


def map_stage(status_text, ng_status=None):
    """進行ステータスを stage にマッピング"""
    if not status_text or not isinstance(status_text, str):
        return 'applied', 'new'
    s = status_text.strip()
    if s == 'NG':
        return 'applied', 'rejected'
    elif s in ('内定', '内定承諾'):
        return 'offer', 'offer'
    elif s == '入社':
        return 'hired', 'hired'
    elif '最終' in s:
        return 'final_interview', 'interview'
    elif '2次' in s:
        return 'second_interview', 'interview'
    elif '1次' in s:
        return 'first_interview', 'interview'
    elif 'カジュアル' in s or '書類' in s:
        return 'document_screening', 'screening'
    return 'applied', 'new'


def map_result(result_text):
    """合否をstatus文字列にマッピング"""
    if not result_text or not isinstance(result_text, str):
        return None
    r = result_text.strip()
    if '合格' in r and '不' not in r:
        return 'passed'
    elif '不合格' in r:
        return 'failed'
    return None


def import_candidate_management(df, conn):
    """01_候補者管理シートをインポート"""
    cursor = conn.cursor()

    # ヘッダー行を特定（「番号」「名前」が含まれる行）
    header_row = None
    for i, row in df.iterrows():
        vals = [str(v) for v in row.values if not pd.isna(v)]
        if '名前' in vals and '番号' in vals:
            header_row = i
            break

    if header_row is None:
        print("  候補者管理シートのヘッダーが見つかりません")
        return 0, 0

    # ヘッダーを設定してデータを再構成
    headers = df.iloc[header_row].values
    data = df.iloc[header_row + 1:].copy()
    data.columns = headers

    imported_candidates = 0
    imported_applications = 0
    skipped = 0

    for _, row in data.iterrows():
        name = row.get('名前')
        if pd.isna(name) or not isinstance(name, str) or name.strip() == '' or name == '名前':
            skipped += 1
            continue

        name = clean_name(name.strip())
        position = str(row.get('ポジション', '')) if not pd.isna(row.get('ポジション')) else ''
        source_type = str(row.get('流入', '')) if not pd.isna(row.get('流入')) else ''
        source_detail = str(row.get('エージェント名/媒体名', '')) if not pd.isna(row.get('エージェント名/媒体名')) else ''
        source = f"{source_type} ({source_detail})" if source_detail else source_type
        gender = str(row.get('性別', '')) if not pd.isna(row.get('性別')) else ''
        age = str(row.get('年齢', '')) if not pd.isna(row.get('年齢')) else ''
        status_text = str(row.get('進行ステータス', '')) if not pd.isna(row.get('進行ステータス')) else ''
        ng_status = str(row.get('NGステータス', '')) if not pd.isna(row.get('NGステータス')) else ''
        ng_detail = str(row.get('NG詳細', '')) if not pd.isna(row.get('NG詳細')) else ''
        result = str(row.get('結果', '')) if not pd.isna(row.get('結果')) else ''

        # 候補者名でメールアドレスを生成（実データにメールがないため）
        email = f"{name.replace(' ', '_')}@import.local"

        # 既存チェック
        cursor.execute("SELECT id FROM candidates WHERE email = ?", (email,))
        existing = cursor.fetchone()
        if existing:
            candidate_id = existing['id']
        else:
            notes_parts = []
            if gender:
                notes_parts.append(f"性別: {gender}")
            if age:
                notes_parts.append(f"年齢: {age}")
            if ng_status:
                notes_parts.append(f"NGステータス: {ng_status}")
            if ng_detail:
                notes_parts.append(f"NG詳細: {ng_detail}")
            notes = ', '.join(notes_parts)

            cursor.execute("""
                INSERT INTO candidates (name, email, source, notes)
                VALUES (?, ?, ?, ?)
            """, (name, email, source, notes))
            candidate_id = cursor.lastrowid
            imported_candidates += 1

        # ポジションに対応する求人を取得/作成
        if position:
            position = position.strip()
            cursor.execute("SELECT id FROM jobs WHERE title = ?", (position,))
            job = cursor.fetchone()
            if not job:
                dept = 'マーケティング' if 'マーケ' in position else '営業' if '営業' in position else '開発' if 'エンジニア' in position or '運用' in position else '人事' if '人事' in position else 'その他'
                cursor.execute("""
                    INSERT INTO jobs (title, department, employment_type, location, description, requirements, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (position, dept, 'フルタイム', '東京', f'{position}の募集', '', 'open'))
                job_id = job_id = cursor.lastrowid
            else:
                job_id = job['id']

            # 応募が既に存在するかチェック
            cursor.execute("SELECT id FROM applications WHERE candidate_id = ? AND job_id = ?",
                           (candidate_id, job_id))
            if not cursor.fetchone():
                stage, app_status = map_stage(status_text, ng_status)
                if result == '×':
                    app_status = 'rejected'

                # 応募日を取得
                applied_date = parse_date(row.get('書類確認中')) or parse_date(row.get('最新日')) or datetime.now().isoformat()

                cursor.execute("""
                    INSERT INTO applications (candidate_id, job_id, status, stage, applied_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (candidate_id, job_id, app_status, stage, applied_date, applied_date))
                imported_applications += 1

    conn.commit()
    print(f"  候補者管理: {imported_candidates}名インポート, {imported_applications}件の応募作成, {skipped}件スキップ")
    return imported_candidates, imported_applications


def import_interviews_sheet(df, conn, stage_name, stage_key):
    """面接シートをインポート"""
    cursor = conn.cursor()
    imported = 0

    # ヘッダー行を特定
    header_row = None
    for i, row in df.iterrows():
        vals = [str(v) for v in row.values if not pd.isna(v)]
        if '候補者名' in vals or '求職者名' in vals:
            header_row = i
            break

    if header_row is None:
        # 1次面接シートはそのまま使える場合がある
        if '求職者名' in df.columns:
            pass  # 既にヘッダーあり
        else:
            print(f"  {stage_name}: ヘッダーが見つかりません")
            return 0
    else:
        headers = df.iloc[header_row].values
        df = df.iloc[header_row + 1:].copy()
        df.columns = headers

    name_col = '候補者名' if '候補者名' in df.columns else '求職者名' if '求職者名' in df.columns else None
    date_col = '面接日' if '面接日' in df.columns else '面接日時' if '面接日時' in df.columns else None
    result_col = '合否' if '合否' in df.columns else None

    if not name_col:
        print(f"  {stage_name}: 名前カラムが見つかりません")
        return 0

    for _, row in df.iterrows():
        name = row.get(name_col)
        if pd.isna(name) or not isinstance(name, str) or name.strip() == '' or name in ('例', '〇〇'):
            continue

        name = clean_name(name.strip())
        interview_date = parse_date(row.get(date_col)) if date_col else None
        result = str(row.get(result_col, '')) if result_col and not pd.isna(row.get(result_col)) else ''
        interviewer = str(row.get('面接者', '')) if '面接者' in df.columns and not pd.isna(row.get('面接者')) else ''
        position = str(row.get('ポジション', '')) if 'ポジション' in df.columns and not pd.isna(row.get('ポジション')) else ''
        comment_col = '面談者のコメント' if '面談者のコメント' in df.columns else None
        comment = str(row.get(comment_col, '')) if comment_col and not pd.isna(row.get(comment_col)) else ''

        # 候補者を名前で検索
        email = f"{name.replace(' ', '_')}@import.local"
        cursor.execute("SELECT id FROM candidates WHERE email = ?", (email,))
        candidate = cursor.fetchone()
        if not candidate:
            cursor.execute("INSERT INTO candidates (name, email, source) VALUES (?, ?, ?)",
                           (name, email, f'{stage_name}シートからインポート'))
            candidate_id = cursor.lastrowid
        else:
            candidate_id = candidate['id']

        # 応募を取得
        cursor.execute("""
            SELECT a.id FROM applications a
            WHERE a.candidate_id = ?
            ORDER BY a.applied_at DESC LIMIT 1
        """, (candidate_id,))
        app = cursor.fetchone()

        if not app:
            # ポジションから求人を探す
            job_id = None
            if position:
                cursor.execute("SELECT id FROM jobs WHERE title LIKE ?", (f'%{position}%',))
                job = cursor.fetchone()
                if job:
                    job_id = job['id']
            if not job_id:
                cursor.execute("SELECT id FROM jobs LIMIT 1")
                job = cursor.fetchone()
                job_id = job['id'] if job else None

            if job_id:
                cursor.execute("""
                    INSERT INTO applications (candidate_id, job_id, status, stage, applied_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (candidate_id, job_id, 'interview', stage_key,
                      interview_date or datetime.now().isoformat()))
                app_id = cursor.lastrowid
            else:
                continue
        else:
            app_id = app['id']
            # ステージを更新
            cursor.execute("UPDATE applications SET stage = ?, status = 'interview' WHERE id = ? AND stage < ?",
                           (stage_key, app_id, stage_key))

        # 面接レコードを作成
        status = 'completed'
        interview_type = 'onsite'

        cursor.execute("""
            INSERT INTO interviews (application_id, interviewer_name, scheduled_at,
                                   duration_minutes, location, interview_type, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (app_id, interviewer, interview_date, 60, '東京オフィス', interview_type,
              f"合否: {result}\n{comment[:500] if comment else ''}", status))
        imported += 1

    conn.commit()
    print(f"  {stage_name}: {imported}件の面接データをインポート")
    return imported


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 import_excel.py <excel_file>")
        sys.exit(1)

    excel_path = sys.argv[1]
    if not Path(excel_path).exists():
        print(f"ファイルが見つかりません: {excel_path}")
        sys.exit(1)

    print(f"インポート開始: {excel_path}")
    print("=" * 50)

    # Excelファイルを読み込み
    sheets = pd.read_excel(excel_path, sheet_name=None)
    print(f"検出されたシート: {list(sheets.keys())}")
    print()

    conn = get_db()

    # 1. 候補者管理シートのインポート（メインデータ）
    if '01_候補者管理' in sheets:
        print("[1/4] 候補者管理シートをインポート中...")
        import_candidate_management(sheets['01_候補者管理'], conn)
    print()

    # 2. 1次面接のインポート
    if '1次面接' in sheets:
        print("[2/4] 1次面接シートをインポート中...")
        import_interviews_sheet(sheets['1次面接'], conn, '1次面接', 'first_interview')
    print()

    # 3. 2次面接のインポート
    if '2次面接' in sheets:
        print("[3/4] 2次面接シートをインポート中...")
        import_interviews_sheet(sheets['2次面接'], conn, '2次面接', 'second_interview')
    print()

    # 4. 最終面接のインポート
    if '最終面接' in sheets:
        print("[4/4] 最終面接シートをインポート中...")
        import_interviews_sheet(sheets['最終面接'], conn, '最終面接', 'final_interview')
    print()

    # アクティビティログを追加
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('system', 0, 'import', f'Excelファイルからデータをインポート: {Path(excel_path).name}', 'System'))
    conn.commit()

    # サマリーを表示
    print("=" * 50)
    print("インポート完了！")
    for table in ['candidates', 'jobs', 'applications', 'interviews']:
        cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
        count = cursor.fetchone()['count']
        print(f"  {table}: {count}件")

    conn.close()


if __name__ == '__main__':
    main()
