import json
from datetime import datetime, timedelta
from database import get_db


def register_routes(router):
    """Register report-related routes"""
    router.get(r'/api/reports/summary', get_summary)
    router.get(r'/api/reports/pipeline', get_pipeline_stats)
    router.get(r'/api/reports/funnel', get_pipeline_stats)
    router.get(r'/api/reports/sources', get_sources_breakdown)
    router.get(r'/api/reports/time-to-hire', get_time_to_hire)
    router.get(r'/api/reports/department', get_department_breakdown)


def get_summary(request):
    """GET /api/reports/summary - Get hiring funnel summary"""
    conn = get_db()
    cursor = conn.cursor()

    # Get funnel metrics
    cursor.execute("""
        SELECT
            COUNT(*) as total_candidates,
            COUNT(DISTINCT CASE WHEN status IN ('screening', 'interview', 'offer', 'hired') THEN candidate_id END) as active_candidates,
            COUNT(DISTINCT CASE WHEN status = 'hired' THEN candidate_id END) as hired,
            COUNT(DISTINCT CASE WHEN status = 'rejected' THEN candidate_id END) as rejected
        FROM applications
    """)

    funnel = dict(cursor.fetchone())

    # Calculate conversion rates
    if funnel['total_candidates'] > 0:
        funnel['conversion_to_hired'] = round((funnel['hired'] / funnel['total_candidates']) * 100, 2)
        funnel['conversion_to_active'] = round((funnel['active_candidates'] / funnel['total_candidates']) * 100, 2)
    else:
        funnel['conversion_to_hired'] = 0
        funnel['conversion_to_active'] = 0

    # Get open jobs count
    cursor.execute("SELECT COUNT(*) as count FROM jobs WHERE status = 'open'")
    open_jobs = cursor.fetchone()['count']

    # Get total jobs count
    cursor.execute("SELECT COUNT(*) as count FROM jobs")
    total_jobs = cursor.fetchone()['count']

    conn.close()

    return {
        'status': 200,
        'data': {
            'funnel': funnel,
            'jobs': {
                'open': open_jobs,
                'total': total_jobs
            }
        }
    }


def get_pipeline_stats(request):
    """GET /api/reports/pipeline - Get pipeline statistics"""
    conn = get_db()
    cursor = conn.cursor()

    # Get stage distribution
    cursor.execute("""
        SELECT stage, COUNT(*) as count
        FROM applications
        GROUP BY stage
        ORDER BY CASE stage
            WHEN 'applied' THEN 1
            WHEN 'document_screening' THEN 2
            WHEN 'first_interview' THEN 3
            WHEN 'second_interview' THEN 4
            WHEN 'final_interview' THEN 5
            WHEN 'offer' THEN 6
            WHEN 'hired' THEN 7
            WHEN 'rejected' THEN 8
            ELSE 9
        END
    """)

    stages = {}
    for row in cursor.fetchall():
        stages[row['stage']] = row['count']

    # Get status distribution
    cursor.execute("""
        SELECT status, COUNT(*) as count
        FROM applications
        GROUP BY status
    """)

    statuses = {}
    for row in cursor.fetchall():
        statuses[row['status']] = row['count']

    conn.close()

    return {
        'status': 200,
        'data': {
            'stages': stages,
            'statuses': statuses
        }
    }


def get_sources_breakdown(request):
    """GET /api/reports/sources - Get candidate source breakdown"""
    conn = get_db()
    cursor = conn.cursor()

    # Get candidate sources
    cursor.execute("""
        SELECT source, COUNT(*) as count
        FROM candidates
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY count DESC
    """)

    sources = {}
    for row in cursor.fetchall():
        sources[row['source']] = row['count']

    # Get applications by source
    cursor.execute("""
        SELECT c.source, COUNT(*) as applications,
               COUNT(DISTINCT CASE WHEN a.status = 'hired' THEN 1 END) as hired
        FROM candidates c
        LEFT JOIN applications a ON c.id = a.candidate_id
        WHERE c.source IS NOT NULL
        GROUP BY c.source
    """)

    source_apps = {}
    for row in cursor.fetchall():
        source_apps[row['source']] = {
            'applications': row['applications'],
            'hired': row['hired'],
            'conversion_rate': round((row['hired'] / row['applications'] * 100) if row['applications'] > 0 else 0, 2)
        }

    conn.close()

    return {
        'status': 200,
        'data': {
            'sources': sources,
            'source_metrics': source_apps
        }
    }


def get_time_to_hire(request):
    """GET /api/reports/time-to-hire - Get average time to hire"""
    conn = get_db()
    cursor = conn.cursor()

    # Get applications with hire status
    cursor.execute("""
        SELECT a.applied_at, a.updated_at
        FROM applications a
        WHERE a.status = 'hired'
    """)

    times = []
    now = datetime.now()

    for row in cursor.fetchall():
        try:
            applied = datetime.fromisoformat(row['applied_at'])
            updated = datetime.fromisoformat(row['updated_at']) if row['updated_at'] else now
            days_to_hire = (updated - applied).days
            times.append(days_to_hire)
        except:
            pass

    avg_time = round(sum(times) / len(times), 1) if times else 0
    min_time = min(times) if times else 0
    max_time = max(times) if times else 0

    conn.close()

    return {
        'status': 200,
        'data': {
            'average_days': avg_time,
            'min_days': min_time,
            'max_days': max_time,
            'total_hired': len(times)
        }
    }


def get_department_breakdown(request):
    """GET /api/reports/department - Get department breakdown"""
    conn = get_db()
    cursor = conn.cursor()

    # Get jobs by department
    cursor.execute("""
        SELECT department, COUNT(*) as count,
               COUNT(CASE WHEN status = 'open' THEN 1 END) as open_positions
        FROM jobs
        GROUP BY department
        ORDER BY count DESC
    """)

    departments = {}
    for row in cursor.fetchall():
        departments[row['department']] = {
            'total_jobs': row['count'],
            'open_positions': row['open_positions']
        }

    # Get applications by department
    cursor.execute("""
        SELECT j.department, COUNT(*) as applications,
               COUNT(DISTINCT CASE WHEN a.status = 'hired' THEN 1 END) as hired,
               COUNT(DISTINCT CASE WHEN a.status = 'rejected' THEN 1 END) as rejected
        FROM jobs j
        LEFT JOIN applications a ON j.id = a.job_id
        GROUP BY j.department
    """)

    for row in cursor.fetchall():
        dept = row['department']
        if dept not in departments:
            departments[dept] = {'total_jobs': 0, 'open_positions': 0}
        departments[dept].update({
            'applications': row['applications'],
            'hired': row['hired'],
            'rejected': row['rejected']
        })

    conn.close()

    return {
        'status': 200,
        'data': {
            'departments': departments
        }
    }
