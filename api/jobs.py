import json
from datetime import datetime
from database import get_db
from server import parse_json_body, get_pagination_params, convert_keys_to_camel


def register_routes(router):
    """Register job-related routes"""
    router.get(r'/api/jobs', list_jobs)
    router.get(r'/api/jobs/(?P<job_id>\d+)', get_job)
    router.post(r'/api/jobs', create_job)
    router.put(r'/api/jobs/(?P<job_id>\d+)', update_job)
    router.delete(r'/api/jobs/(?P<job_id>\d+)', delete_job)
    router.get(r'/api/jobs/(?P<job_id>\d+)/applications', get_job_applications)


def list_jobs(request):
    """GET /api/jobs - List jobs with filters"""
    conn = get_db()
    cursor = conn.cursor()

    # Get query parameters
    status = request['params'].get('status', [None])[0]
    department = request['params'].get('department', [None])[0]
    search = request['params'].get('search', [None])[0]

    # Build query to get application counts
    query = """
        SELECT j.id, j.title, j.department, j.employment_type as type, j.location,
               j.salary_min as salaryMin, j.salary_max as salaryMax,
               j.description, j.requirements, j.status, j.created_at as createdAt,
               COUNT(a.id) as applicationCount
        FROM jobs j
        LEFT JOIN applications a ON j.id = a.job_id
        WHERE 1=1
    """
    params = []

    if status:
        query += " AND j.status = ?"
        params.append(status)

    if department:
        query += " AND j.department = ?"
        params.append(department)

    if search:
        query += " AND (j.title LIKE ? OR j.description LIKE ? OR j.requirements LIKE ?)"
        search_term = f"%{search}%"
        params.extend([search_term, search_term, search_term])

    query += " GROUP BY j.id ORDER BY j.created_at DESC"

    # Execute query
    cursor.execute(query, params)
    jobs = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Convert to camelCase and return as array in data
    jobs = convert_keys_to_camel(jobs)

    return {
        'status': 200,
        'data': jobs
    }


def get_job(request):
    """GET /api/jobs/:id - Get job detail"""
    job_id = request['route_params']['job_id']

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    job = cursor.fetchone()

    if not job:
        conn.close()
        return {'status': 404, 'data': {'error': 'Job not found'}}

    # Get application count by status
    cursor.execute("""
        SELECT status, COUNT(*) as count
        FROM applications
        WHERE job_id = ?
        GROUP BY status
    """, (job_id,))
    status_counts = {row['status']: row['count'] for row in cursor.fetchall()}

    conn.close()

    result = dict(job)
    result['application_stats'] = status_counts

    return {'status': 200, 'data': result}


def create_job(request):
    """POST /api/jobs - Create new job"""
    data = parse_json_body(request['body'])

    # Validate required fields
    required = ['title', 'department', 'employment_type', 'location']
    if not all(field in data for field in required):
        return {'status': 400, 'data': {'error': 'Missing required fields'}}

    conn = get_db()
    cursor = conn.cursor()

    now = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO jobs (title, department, employment_type, location, salary_min, salary_max,
                         description, requirements, status, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data['title'],
        data['department'],
        data['employment_type'],
        data['location'],
        data.get('salary_min'),
        data.get('salary_max'),
        data.get('description', ''),
        data.get('requirements', ''),
        data.get('status', 'open'),
        now
    ))

    job_id = cursor.lastrowid

    # Log activity
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('job', job_id, 'created', f'Job created: {data["title"]}', 'System'))

    conn.commit()
    conn.close()

    return {
        'status': 201,
        'data': {'id': job_id, 'message': 'Job created successfully'}
    }


def update_job(request):
    """PUT /api/jobs/:id - Update job"""
    job_id = request['route_params']['job_id']
    data = parse_json_body(request['body'])

    conn = get_db()
    cursor = conn.cursor()

    # Check if job exists
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Job not found'}}

    # Build update query
    updates = []
    params = []
    allowed_fields = ['title', 'department', 'employment_type', 'location', 'salary_min',
                     'salary_max', 'description', 'requirements', 'status']

    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = ?")
            params.append(data[field])

    if updates:
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(job_id)

        query = "UPDATE jobs SET " + ", ".join(updates) + " WHERE id = ?"
        cursor.execute(query, params)

        # Log activity
        cursor.execute("""
            INSERT INTO activities (entity_type, entity_id, action, description, user_name)
            VALUES (?, ?, ?, ?, ?)
        """, ('job', job_id, 'updated', f'Job updated: {data.get("title", "ID " + str(job_id))}', 'System'))

    conn.commit()
    conn.close()

    return {'status': 200, 'data': {'message': 'Job updated successfully'}}


def delete_job(request):
    """DELETE /api/jobs/:id - Delete job"""
    job_id = request['route_params']['job_id']

    conn = get_db()
    cursor = conn.cursor()

    # Check if job exists
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Job not found'}}

    # Log activity before deletion
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('job', job_id, 'deleted', f'Job deleted: ID {job_id}', 'System'))

    # Delete job
    cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))

    conn.commit()
    conn.close()

    return {'status': 200, 'data': {'message': 'Job deleted successfully'}}


def get_job_applications(request):
    """GET /api/jobs/:id/applications - Get applications for a job"""
    job_id = request['route_params']['job_id']
    page, per_page = get_pagination_params(request['params'])

    conn = get_db()
    cursor = conn.cursor()

    # Verify job exists
    cursor.execute("SELECT id FROM jobs WHERE id = ?", (job_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Job not found'}}

    # Get total count
    cursor.execute("SELECT COUNT(*) as count FROM applications WHERE job_id = ?", (job_id,))
    total = cursor.fetchone()['count']

    # Get applications
    cursor.execute("""
        SELECT a.*, c.name as candidate_name, c.email as candidate_email
        FROM applications a
        JOIN candidates c ON a.candidate_id = c.id
        WHERE a.job_id = ?
        ORDER BY a.applied_at DESC
        LIMIT ? OFFSET ?
    """, (job_id, per_page, (page - 1) * per_page))

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
