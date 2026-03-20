#!/usr/bin/env python3
"""
ATS (採用管理システム) - Recruitment Management System Backend
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from database import init_db, seed_demo_data, get_db
from server import Router, create_app

# Import API modules
from api import jobs
from api import candidates
from api import applications
from api import interviews
from api import evaluations
from api import activities
from api import reports


def main():
    """Initialize and run the ATS server"""

    # Initialize database
    print("データベースを初期化中...")
    init_db()

    # Seed demo data if needed
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM users")
    has_data = cursor.fetchone()['count'] > 0
    conn.close()

    if not has_data:
        print("デモデータをシードします...")
        seed_demo_data()
    else:
        print("既存のデータベースを使用しています。")

    # Create router and register all routes
    router = Router()

    print("ルートを登録中...")
    jobs.register_routes(router)
    candidates.register_routes(router)
    applications.register_routes(router)
    interviews.register_routes(router)
    evaluations.register_routes(router)
    activities.register_routes(router)
    reports.register_routes(router)

    # Add health check endpoint
    def health_check(request):
        return {
            'status': 200,
            'data': {
                'status': 'ok',
                'message': 'ATS system is running'
            }
        }

    router.get(r'/api/health', health_check)

    # Create and start server
    print("サーバーを起動中...")
    static_dir = str(Path(__file__).parent / 'static')
    server = create_app(router, static_dir=static_dir)

    try:
        print("\n採用管理システム起動中: http://localhost:8080")
        print("Ctrl+C で停止します\n")
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\nサーバーを停止しています...")
        server.server_close()
        print("完了。")


if __name__ == '__main__':
    main()
