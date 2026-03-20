import json
from datetime import datetime
from database import get_db
from server import parse_json_body, get_pagination_params


def register_routes(router):
    """Register candidate-related routes"""
    router.get(r'/api/candidates', list_candidates)
    router.get(r'/api/candidates/(?P<candidate_id>\d+)', get_candidate)
    router.post(r'/api/candidates', create_candidate)
    router.put(r'/api/candidates/(?P<candidate_id>\d+)', update_candidate)
    router.delete(r'/api/candidates/(?P<candidate_id>\d+)', delete_candidate)


def list_candidates(request):
    """GET /api/candidates - List candidates with search/filter"""
    conn = get_db()
    cursor = conn.cursor()

    # Get query parameters
    search = request['params'].get('search', [None])[0]
    source = request['params'].get('source', [None])[0]
    page, per_page = get_pagination_params(request['params'])

    # Build query
    query = "SELECT * FROM candidates WHERE 1=1"
    params = []

    if search:
        query += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)"
        search_term = f"%{search}%"
        params.extend([search_term, search_term, search_term])

    if source:
        query += " AND source = ?"
        params.append(source)

    # Get total count
    count_query = query.replace("SELECT *", "SELECT COUNT(*) as count")
    cursor.execute(count_query, params)
    total = cursor.fetchone()['count']

    # Add pagination and ordering
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([per_page, (page - 1) * per_page])

    cursor.execute(query, params)
    candidates = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        'status': 200,
        'data': {
            'candidates': candidates,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }
    }


def get_candidate(request):
    """GET /api/candidates/:id - Get candidate detail with application history"""
    candidate_id = request['route_params']['candidate_id']

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    candidate = cursor.fetchone()

    if not candidate:
        conn.close()
        return {'status': 404, 'data': {'error': 'Candidate not found'}}

    # Get application history
    cursor.execute("""
        SELECT a.*, j.title as job_title, j.department
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.candidate_id = ?
        ORDER BY a.applied_at DESC
    """, (candidate_id,))
    applications = [dict(row) for row in cursor.fetchall()]

    conn.close()

    result = dict(candidate)
    result['applications'] = applications

    return {'status': 200, 'data': result}


def create_candidate(request):
    """POST /api/candidates - Create new candidate"""
    data = parse_json_body(request['body'])

    # Validate required fields
    if 'name' not in data or 'email' not in data:
        return {'status': 400, 'data': {'error': 'Name and email are required'}}

    conn = get_db()
    cursor = conn.cursor()

    # Check if email already exists
    cursor.execute("SELECT id FROM candidates WHERE email = ?", (data['email'],))
    if cursor.fetchone():
        conn.close()
        return {'status': 409, 'data': {'error': 'Candidate with this email already exists'}}

    now = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO candidates (name, email, phone, resume_url, source, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        data['name'],
        data['email'],
        data.get('phone'),
        data.get('resume_url'),
        data.get('source', 'direct'),
        data.get('notes', '')
    ))

    candidate_id = cursor.lastrowid

    # Log activity
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('candidate', candidate_id, 'created', f'Candidate created: {data["name"]}', 'System'))

    conn.commit()
    conn.close()

    return {
        'status': 201,
        'data': {'id': candidate_id, 'message': 'Candidate created successfully'}
    }


def update_candidate(request):
    """PUT /api/candidates/:id - Update candidate"""
    candidate_id = request['route_params']['candidate_id']
    data = parse_json_body(request['body'])

    conn = get_db()
    cursor = conn.cursor()

    # Check if candidate exists
    cursor.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Candidate not found'}}

    # Build update query
    updates = []
    params = []
    allowed_fields = ['name', 'email', 'phone', 'resume_url', 'source', 'notes']

    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = ?")
            params.append(data[field])

    if updates:
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(candidate_id)

        query = "UPDATE candidates SET " + ", ".join(updates) + " WHERE id = ?"
        cursor.execute(query, params)

        # Log activity
        cursor.execute("""
            INSERT INTO activities (entity_type, entity_id, action, description, user_name)
            VALUES (?, ?, ?, ?, ?)
        """, ('candidate', candidate_id, 'updated', f'Candidate updated: {data.get("name", "ID " + str(candidate_id))}', 'System'))

    conn.commit()
    conn.close()

    return {'status': 200, 'data': {'message': 'Candidate updated successfully'}}


def delete_candidate(request):
    """DELETE /api/candidates/:id - Delete candidate"""
    candidate_id = request['route_params']['candidate_id']

    conn = get_db()
    cursor = conn.cursor()

    # Check if candidate exists
    cursor.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Candidate not found'}}

    # Log activity before deletion
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('candidate', candidate_id, 'deleted', f'Candidate deleted: ID {candidate_id}', 'System'))

    # Delete candidate (cascade delete handled by database constraints)
    cursor.execute("DELETE FROM candidates WHERE id = ?", (candidate_id,))

    conn.commit()
    conn.close()

    return {'status': 200, 'data': {'message': 'Candidate deleted successfully'}}
