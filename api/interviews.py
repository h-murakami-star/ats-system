import json
from datetime import datetime, timedelta
from database import get_db
from server import parse_json_body, get_pagination_params, convert_keys_to_camel


def register_routes(router):
    """Register interview-related routes"""
    router.get(r'/api/interviews', list_interviews)
    router.get(r'/api/interviews/(?P<interview_id>\d+)', get_interview)
    router.post(r'/api/interviews', schedule_interview)
    router.put(r'/api/interviews/(?P<interview_id>\d+)', update_interview)
    router.delete(r'/api/interviews/(?P<interview_id>\d+)', cancel_interview)


def list_interviews(request):
    """GET /api/interviews - List interviews with date range filter"""
    conn = get_db()
    cursor = conn.cursor()

    # Get query parameters
    start_date = request['params'].get('start_date', [None])[0]
    end_date = request['params'].get('end_date', [None])[0]
    filter_param = request['params'].get('filter', [None])[0]
    limit = request['params'].get('limit', [None])[0]

    # Build query
    query = """
        SELECT i.id, i.application_id, i.scheduled_at as scheduledAt, i.interview_type as interviewType,
               i.duration_minutes, i.location, i.notes, i.status,
               c.name as candidateName, j.title as jobTitle
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
        WHERE 1=1
    """
    params = []

    # Handle filter=upcoming
    if filter_param == 'upcoming':
        query += " AND i.status = 'scheduled' AND i.scheduled_at > datetime('now')"

    if start_date:
        query += " AND i.scheduled_at >= ?"
        params.append(start_date)

    if end_date:
        query += " AND i.scheduled_at <= ?"
        params.append(end_date)

    # Add ordering
    query += " ORDER BY i.scheduled_at ASC"

    # Add limit if specified
    if limit:
        try:
            limit_val = int(limit)
            query += " LIMIT ?"
            params.append(limit_val)
        except (ValueError, TypeError):
            pass

    cursor.execute(query, params)
    interviews = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Convert to camelCase and return as array
    interviews = convert_keys_to_camel(interviews)

    return {
        'status': 200,
        'data': interviews
    }


def get_interview(request):
    """GET /api/interviews/:id - Get interview detail"""
    interview_id = request['route_params']['interview_id']

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT i.*, a.candidate_id, c.name as candidate_name, c.email as candidate_email,
               j.title as job_title, j.department
        FROM interviews i
        JOIN applications a ON i.application_id = a.id
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
        WHERE i.id = ?
    """, (interview_id,))

    interview = cursor.fetchone()

    if not interview:
        conn.close()
        return {'status': 404, 'data': {'error': 'Interview not found'}}

    # Get evaluations for this interview
    cursor.execute("""
        SELECT * FROM evaluations
        WHERE interview_id = ?
    """, (interview_id,))
    evaluations = [dict(row) for row in cursor.fetchall()]

    conn.close()

    result = dict(interview)
    result['evaluations'] = evaluations

    return {'status': 200, 'data': result}


def schedule_interview(request):
    """POST /api/interviews - Schedule new interview"""
    data = parse_json_body(request['body'])

    # Validate required fields
    required = ['application_id', 'scheduled_at', 'interview_type']
    if not all(field in data for field in required):
        return {'status': 400, 'data': {'error': 'Missing required fields'}}

    conn = get_db()
    cursor = conn.cursor()

    application_id = data['application_id']

    # Verify application exists
    cursor.execute("SELECT id FROM applications WHERE id = ?", (application_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Application not found'}}

    cursor.execute("""
        INSERT INTO interviews (application_id, interviewer_name, scheduled_at,
                               duration_minutes, location, interview_type, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        application_id,
        data.get('interviewer_name'),
        data['scheduled_at'],
        data.get('duration_minutes', 60),
        data.get('location'),
        data['interview_type'],
        data.get('notes'),
        'scheduled'
    ))

    interview_id = cursor.lastrowid

    # Log activity
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('interview', interview_id, 'scheduled', f'Interview scheduled for application {application_id}', 'System'))

    conn.commit()
    conn.close()

    return {
        'status': 201,
        'data': {'id': interview_id, 'message': 'Interview scheduled successfully'}
    }


def update_interview(request):
    """PUT /api/interviews/:id - Update interview"""
    interview_id = request['route_params']['interview_id']
    data = parse_json_body(request['body'])

    conn = get_db()
    cursor = conn.cursor()

    # Check if interview exists
    cursor.execute("SELECT * FROM interviews WHERE id = ?", (interview_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Interview not found'}}

    # Build update query
    updates = []
    params = []
    allowed_fields = ['interviewer_name', 'scheduled_at', 'duration_minutes',
                     'location', 'interview_type', 'notes', 'status']

    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = ?")
            params.append(data[field])

    if updates:
        params.append(interview_id)
        query = "UPDATE interviews SET " + ", ".join(updates) + " WHERE id = ?"
        cursor.execute(query, params)

        # Log activity
        cursor.execute("""
            INSERT INTO activities (entity_type, entity_id, action, description, user_name)
            VALUES (?, ?, ?, ?, ?)
        """, ('interview', interview_id, 'updated', f'Interview updated: {data.get("status", "modified")}', 'System'))

    conn.commit()
    conn.close()

    return {'status': 200, 'data': {'message': 'Interview updated successfully'}}


def cancel_interview(request):
    """DELETE /api/interviews/:id - Cancel interview"""
    interview_id = request['route_params']['interview_id']

    conn = get_db()
    cursor = conn.cursor()

    # Check if interview exists
    cursor.execute("SELECT * FROM interviews WHERE id = ?", (interview_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Interview not found'}}

    # Log activity
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('interview', interview_id, 'cancelled', f'Interview cancelled: ID {interview_id}', 'System'))

    # Update status to cancelled instead of deleting
    cursor.execute("UPDATE interviews SET status = ? WHERE id = ?", ('cancelled', interview_id))

    conn.commit()
    conn.close()

    return {'status': 200, 'data': {'message': 'Interview cancelled successfully'}}
