import json
from datetime import datetime
from database import get_db
from server import parse_json_body, get_pagination_params


def register_routes(router):
    """Register application-related routes"""
    router.get(r'/api/applications', list_applications)
    router.get(r'/api/applications/(?P<application_id>\d+)', get_application)
    router.post(r'/api/applications', create_application)
    router.put(r'/api/applications/(?P<application_id>\d+)', update_application)
    router.get(r'/api/pipeline', get_pipeline)


def list_applications(request):
    """GET /api/applications - List applications with filters"""
    conn = get_db()
    cursor = conn.cursor()

    # Get query parameters
    status = request['params'].get('status', [None])[0]
    stage = request['params'].get('stage', [None])[0]
    job_id = request['params'].get('job_id', [None])[0]
    page, per_page = get_pagination_params(request['params'])

    # Build query
    query = """
        SELECT a.*, c.name as candidate_name, c.email as candidate_email,
               j.title as job_title
        FROM applications a
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
        WHERE 1=1
    """
    params = []

    if status:
        query += " AND a.status = ?"
        params.append(status)

    if stage:
        query += " AND a.stage = ?"
        params.append(stage)

    if job_id:
        query += " AND a.job_id = ?"
        params.append(job_id)

    # Get total count
    count_query = query.replace("SELECT a.*", "SELECT COUNT(*) as count")
    cursor.execute(count_query, params)
    total = cursor.fetchone()['count']

    # Add pagination and ordering
    query += " ORDER BY a.applied_at DESC LIMIT ? OFFSET ?"
    params.extend([per_page, (page - 1) * per_page])

    cursor.execute(query, params)
    applications = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        'status': 200,
        'data': {
            'applications': applications,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }
    }


def get_application(request):
    """GET /api/applications/:id - Get application detail"""
    application_id = request['route_params']['application_id']

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.*, c.name as candidate_name, c.email as candidate_email,
               c.phone, c.resume_url, j.title as job_title, j.department
        FROM applications a
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = ?
    """, (application_id,))

    application = cursor.fetchone()

    if not application:
        conn.close()
        return {'status': 404, 'data': {'error': 'Application not found'}}

    # Get interviews for this application
    cursor.execute("""
        SELECT * FROM interviews
        WHERE application_id = ?
        ORDER BY scheduled_at DESC
    """, (application_id,))
    interviews = [dict(row) for row in cursor.fetchall()]

    conn.close()

    result = dict(application)
    result['interviews'] = interviews

    return {'status': 200, 'data': result}


def create_application(request):
    """POST /api/applications - Create new application"""
    data = parse_json_body(request['body'])

    # Validate required fields
    if 'candidate_id' not in data or 'job_id' not in data:
        return {'status': 400, 'data': {'error': 'candidate_id and job_id are required'}}

    conn = get_db()
    cursor = conn.cursor()

    candidate_id = data['candidate_id']
    job_id = data['job_id']

    # Verify candidate exists
    cursor.execute("SELECT id FROM candidates WHERE id = ?", (candidate_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Candidate not found'}}

    # Verify job exists
    cursor.execute("SELECT id FROM jobs WHERE id = ?", (job_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Job not found'}}

    # Check if application already exists
    cursor.execute("""
        SELECT id FROM applications
        WHERE candidate_id = ? AND job_id = ?
    """, (candidate_id, job_id))
    if cursor.fetchone():
        conn.close()
        return {'status': 409, 'data': {'error': 'Application already exists'}}

    now = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO applications (candidate_id, job_id, status, stage, applied_at)
        VALUES (?, ?, ?, ?, ?)
    """, (
        candidate_id,
        job_id,
        data.get('status', 'new'),
        data.get('stage', 'applied'),
        now
    ))

    application_id = cursor.lastrowid

    # Log activity
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('application', application_id, 'created', f'Application created for candidate {candidate_id} on job {job_id}', 'System'))

    conn.commit()
    conn.close()

    return {
        'status': 201,
        'data': {'id': application_id, 'message': 'Application created successfully'}
    }


def update_application(request):
    """PUT /api/applications/:id - Update application status/stage"""
    application_id = request['route_params']['application_id']
    data = parse_json_body(request['body'])

    conn = get_db()
    cursor = conn.cursor()

    # Check if application exists
    cursor.execute("SELECT * FROM applications WHERE id = ?", (application_id,))
    app = cursor.fetchone()
    if not app:
        conn.close()
        return {'status': 404, 'data': {'error': 'Application not found'}}

    # Build update query
    updates = []
    params = []
    allowed_fields = ['status', 'stage']

    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = ?")
            params.append(data[field])

    if updates:
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(application_id)

        query = "UPDATE applications SET " + ", ".join(updates) + " WHERE id = ?"
        cursor.execute(query, params)

        # Log activity
        activity_desc = 'Application updated'
        if 'status' in data or 'stage' in data:
            activity_desc = f"Status: {data.get('status', app['status'])} | Stage: {data.get('stage', app['stage'])}"

        cursor.execute("""
            INSERT INTO activities (entity_type, entity_id, action, description, user_name)
            VALUES (?, ?, ?, ?, ?)
        """, ('application', application_id, 'updated', activity_desc, 'System'))

    conn.commit()
    conn.close()

    return {'status': 200, 'data': {'message': 'Application updated successfully'}}


def get_pipeline(request):
    """GET /api/pipeline - Get pipeline view grouped by stage with counts"""
    conn = get_db()
    cursor = conn.cursor()

    # Get pipeline data
    cursor.execute("""
        SELECT stage, COUNT(*) as count, status
        FROM applications
        GROUP BY stage, status
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
        END, status
    """)

    pipeline_data = {}
    for row in cursor.fetchall():
        stage = row['stage']
        if stage not in pipeline_data:
            pipeline_data[stage] = {'total': 0, 'by_status': {}}
        pipeline_data[stage]['total'] += row['count']
        pipeline_data[stage]['by_status'][row['status']] = row['count']

    # Get total funnel metrics
    cursor.execute("""
        SELECT
            COUNT(DISTINCT CASE WHEN stage = 'applied' THEN 1 END) as total_applied,
            COUNT(DISTINCT CASE WHEN stage IN ('document_screening', 'first_interview', 'second_interview', 'final_interview') THEN 1 END) as in_interview,
            COUNT(DISTINCT CASE WHEN stage = 'offer' THEN 1 END) as offers,
            COUNT(DISTINCT CASE WHEN stage = 'hired' THEN 1 END) as hired,
            COUNT(DISTINCT CASE WHEN status = 'rejected' THEN 1 END) as rejected
        FROM applications
    """)

    funnel = dict(cursor.fetchone())

    conn.close()

    return {
        'status': 200,
        'data': {
            'pipeline': pipeline_data,
            'funnel': funnel
        }
    }
