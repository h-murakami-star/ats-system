import json
from datetime import datetime
from database import get_db
from server import parse_json_body, get_pagination_params, convert_keys_to_camel


def register_routes(router):
    """Register activity-related routes"""
    router.get(r'/api/activities', list_activities)
    router.post(r'/api/activities', log_activity)


def list_activities(request):
    """GET /api/activities - Get recent activity log"""
    conn = get_db()
    cursor = conn.cursor()

    # Get query parameters
    entity_type = request['params'].get('entity_type', [None])[0]
    action = request['params'].get('action', [None])[0]
    limit = request['params'].get('limit', [None])[0]

    # Build query
    query = "SELECT id, entity_type, entity_id, action, description as title, description, created_at, user_name FROM activities WHERE 1=1"
    params = []

    if entity_type:
        query += " AND entity_type = ?"
        params.append(entity_type)

    if action:
        query += " AND action = ?"
        params.append(action)

    # Add ordering
    query += " ORDER BY created_at DESC"

    # Add limit if specified
    if limit:
        try:
            limit_val = int(limit)
            query += " LIMIT ?"
            params.append(limit_val)
        except (ValueError, TypeError):
            pass

    cursor.execute(query, params)
    activities = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Convert to camelCase and return as array
    activities = convert_keys_to_camel(activities)

    return {
        'status': 200,
        'data': activities
    }


def log_activity(request):
    """POST /api/activities - Log an activity"""
    data = parse_json_body(request['body'])

    # Validate required fields
    required = ['entity_type', 'entity_id', 'action']
    if not all(field in data for field in required):
        return {'status': 400, 'data': {'error': 'Missing required fields'}}

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, (
        data['entity_type'],
        data['entity_id'],
        data['action'],
        data.get('description', ''),
        data.get('user_name', 'System')
    ))

    activity_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return {
        'status': 201,
        'data': {'id': activity_id, 'message': 'Activity logged successfully'}
    }
