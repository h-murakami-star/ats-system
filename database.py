import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "ats.db"

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with tables"""
    conn = get_db()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'member',
            department TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Jobs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            department TEXT NOT NULL,
            employment_type TEXT,
            location TEXT,
            salary_min INTEGER,
            salary_max INTEGER,
            description TEXT,
            requirements TEXT,
            status TEXT DEFAULT 'open',
            published_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Candidates table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            resume_url TEXT,
            source TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Applications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            job_id INTEGER NOT NULL,
            status TEXT DEFAULT 'new',
            stage TEXT DEFAULT 'applied',
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(candidate_id) REFERENCES candidates(id),
            FOREIGN KEY(job_id) REFERENCES jobs(id)
        )
    """)

    # Interviews table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            interviewer_name TEXT,
            scheduled_at TEXT,
            duration_minutes INTEGER DEFAULT 60,
            location TEXT,
            interview_type TEXT,
            notes TEXT,
            status TEXT DEFAULT 'scheduled',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(application_id) REFERENCES applications(id)
        )
    """)

    # Evaluations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            interview_id INTEGER NOT NULL,
            evaluator_name TEXT,
            technical_score INTEGER,
            communication_score INTEGER,
            culture_fit_score INTEGER,
            motivation_score INTEGER,
            overall_score INTEGER,
            strengths TEXT,
            weaknesses TEXT,
            recommendation TEXT,
            comments TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(interview_id) REFERENCES interviews(id)
        )
    """)

    # Activities table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT,
            entity_id INTEGER,
            action TEXT,
            description TEXT,
            user_name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Departments table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Selection stages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS selection_stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()

def seed_demo_data():
    """Seed database with demo data"""
    conn = get_db()
    cursor = conn.cursor()

    # Check if data already exists
    cursor.execute("SELECT COUNT(*) as count FROM users")
    if cursor.fetchone()['count'] > 0:
        conn.close()
        return

    # Insert demo users
    users_data = [
        ('田中太郎', 'tanaka@example.com', 'admin', '人事'),
        ('佐藤花子', 'sato@example.com', 'recruiter', '人事'),
        ('鈴木一郎', 'suzuki@example.com', 'manager', '開発'),
        ('高橋美咲', 'takahashi@example.com', 'member', '営業'),
    ]

    for name, email, role, dept in users_data:
        cursor.execute(
            "INSERT INTO users (name, email, role, department) VALUES (?, ?, ?, ?)",
            (name, email, role, dept)
        )

    # Insert demo jobs
    now = datetime.now()
    jobs_data = [
        ('シニアPythonエンジニア', '開発', 'フルタイム', '東京', 5500000, 7500000,
         'バックエンド開発を担当するシニアエンジニアを募集しています。',
         'Python 5年以上, AWS経験, スクラム開発経験', 'open', now.isoformat()),
        ('フロントエンドエンジニア', '開発', 'フルタイム', '大阪', 4500000, 6000000,
         'React/Vue.jsを使用したUI開発をリードする立場を求めています。',
         'JavaScript/TypeScript 3年以上, React or Vue経験', 'open', now.isoformat()),
        ('セールスエグゼクティブ', '営業', 'フルタイム', '東京', 4000000, 5500000,
         '法人営業でB2B取引を拡大できる営業員を募集しています。',
         '営業経験 3年以上, BtoB営業経験', 'open', now.isoformat()),
        ('データアナリスト', '開発', 'フルタイム', '東京', 4200000, 5800000,
         'ビッグデータの分析と可視化を行うアナリストを募集しています。',
         'SQL, Python, データ可視化ツール経験', 'open', now.isoformat()),
        ('マーケティングマネージャー', '営業', 'フルタイム', '東京', 4500000, 6200000,
         'デジタルマーケティング戦略を立案・実行するマネージャーを募集しています。',
         'マーケティング経験 5年以上, デジタル広告経験', 'closed', (now - timedelta(days=30)).isoformat()),
    ]

    for title, dept, emp_type, location, min_sal, max_sal, desc, req, status, pub_date in jobs_data:
        cursor.execute("""
            INSERT INTO jobs (title, department, employment_type, location, salary_min, salary_max,
                            description, requirements, status, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (title, dept, emp_type, location, min_sal, max_sal, desc, req, status, pub_date))

    # Insert demo candidates
    candidates_data = [
        ('鈴木健太', 'suzuki.kenta@email.com', '090-1234-5678', 'https://example.com/resume1.pdf', 'LinkedIn', 'Pythonエンジニア'),
        ('山田咲花', 'yamada.sakura@email.com', '090-2345-6789', 'https://example.com/resume2.pdf', '紹介', 'フロントエンド経験者'),
        ('田中次郎', 'tanaka.jiro@email.com', '090-3456-7890', 'https://example.com/resume3.pdf', '求人サイト', 'セールス経験者'),
        ('佐々木美咲', 'sasaki.misaki@email.com', '090-4567-8901', 'https://example.com/resume4.pdf', 'Indeed', 'データ分析スキル有'),
        ('伊藤翔太', 'ito.shota@email.com', '090-5678-9012', 'https://example.com/resume5.pdf', 'LinkedIn', 'シニア開発者'),
        ('木村由美', 'kimura.yumi@email.com', '090-6789-0123', 'https://example.com/resume6.pdf', '求人サイト', '営業経験者'),
        ('吉田健一', 'yoshida.kenichi@email.com', '090-7890-1234', 'https://example.com/resume7.pdf', '紹介', 'フルスタックエンジニア'),
        ('千葉花子', 'chiba.hanako@email.com', '090-8901-2345', 'https://example.com/resume8.pdf', 'Indeed', 'マーケティング経験'),
    ]

    for name, email, phone, resume_url, source, notes in candidates_data:
        cursor.execute("""
            INSERT INTO candidates (name, email, phone, resume_url, source, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, email, phone, resume_url, source, notes))

    # Insert demo applications
    applications_data = [
        (1, 1, 'new', 'applied', (now - timedelta(days=5)).isoformat()),
        (2, 2, 'screening', 'document_screening', (now - timedelta(days=4)).isoformat()),
        (3, 3, 'interview', 'first_interview', (now - timedelta(days=3)).isoformat()),
        (4, 4, 'new', 'applied', (now - timedelta(days=2)).isoformat()),
        (5, 1, 'screening', 'document_screening', (now - timedelta(days=1)).isoformat()),
        (6, 2, 'interview', 'second_interview', (now - timedelta(hours=12)).isoformat()),
        (7, 1, 'new', 'applied', now.isoformat()),
        (8, 3, 'offer', 'offer', (now - timedelta(days=1)).isoformat()),
    ]

    for cand_id, job_id, status, stage, applied_date in applications_data:
        cursor.execute("""
            INSERT INTO applications (candidate_id, job_id, status, stage, applied_at)
            VALUES (?, ?, ?, ?, ?)
        """, (cand_id, job_id, status, stage, applied_date))

    # Insert demo interviews
    interviews_data = [
        (2, '田中太郎', (now + timedelta(days=3)).isoformat(), 60, 'オンライン', 'online', 'スクリーニング面接', 'scheduled'),
        (3, '佐藤花子', (now + timedelta(days=5)).isoformat(), 90, '東京オフィス', 'onsite', '技術面接', 'scheduled'),
        (6, '鈴木一郎', (now + timedelta(days=7)).isoformat(), 60, 'Teams', 'online', '最終面接', 'scheduled'),
    ]

    for app_id, interviewer, scheduled, duration, location, interview_type, notes, status in interviews_data:
        cursor.execute("""
            INSERT INTO interviews (application_id, interviewer_name, scheduled_at, duration_minutes,
                                   location, interview_type, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (app_id, interviewer, scheduled, duration, location, interview_type, notes, status))

    # Insert demo evaluations
    evaluations_data = [
        (1, '田中太郎', 80, 75, 85, 80, 80, '優れたコミュニケーション能力', 'C++の知識が浅い',
         'hire', '面接では良好な印象を与えました'),
    ]

    for interview_id, evaluator, tech, comm, culture, motiv, overall, strengths, weaknesses, rec, comments in evaluations_data:
        cursor.execute("""
            INSERT INTO evaluations (interview_id, evaluator_name, technical_score, communication_score,
                                    culture_fit_score, motivation_score, overall_score, strengths,
                                    weaknesses, recommendation, comments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (interview_id, evaluator, tech, comm, culture, motiv, overall, strengths, weaknesses, rec, comments))

    # Insert demo activities
    activities_data = [
        ('job', 1, 'created', 'シニアPythonエンジニアの求人を作成', '田中太郎'),
        ('candidate', 1, 'created', '鈴木健太をシステムに追加', '佐藤花子'),
        ('application', 1, 'created', '鈴木健太がシニアPythonエンジニアに応募', '佐藤花子'),
        ('application', 2, 'status_changed', 'ステータスを「new」から「screening」に変更', '佐藤花子'),
        ('interview', 1, 'scheduled', '面接をスケジュール', '田中太郎'),
    ]

    for entity_type, entity_id, action, desc, user in activities_data:
        cursor.execute("""
            INSERT INTO activities (entity_type, entity_id, action, description, user_name)
            VALUES (?, ?, ?, ?, ?)
        """, (entity_type, entity_id, action, desc, user))

    # Seed departments
    departments = ['人事', '開発', '営業', 'マーケティング', '経理', '総務']
    for dept in departments:
        cursor.execute("INSERT OR IGNORE INTO departments (name) VALUES (?)", (dept,))

    # Seed selection stages
    stages = [
        ('applied', '応募', 1),
        ('document_screening', '書類選考', 2),
        ('first_interview', '一次面接', 3),
        ('second_interview', '二次面接', 4),
        ('final_interview', '最終面接', 5),
        ('offer', '内定', 6),
        ('hired', '採用', 7),
    ]
    for name, display_name, order in stages:
        cursor.execute("INSERT OR IGNORE INTO selection_stages (name, display_name, sort_order) VALUES (?, ?, ?)",
                       (name, display_name, order))

    conn.commit()
    conn.close()
