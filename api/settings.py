import json
from database import get_db
from server import parse_json_body


def register_routes(router):
    """Register settings-related routes"""
    router.get(r'/api/settings/departments', get_departments)
    router.post(r'/api/settings/departments', create_department)
    router.put(r'/api/settings/departments/(?P<department_id>\d+)', update_department)
    router.delete(r'/api/settings/departments/(?P<department_id>\d+)', delete_department)
    router.get(r'/api/settings/stages', get_stages)
    router.post(r'/api/settings/stages', create_stage)
    router.put(r'/api/settings/stages/(?P<stage_id>\d+)', update_stage)
    router.get(r'/api/settings/system', get_system_info)


def get_departments(request):
    """GET /api/settings/departments"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, created_at FROM departments ORDER BY name")
    departments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {'status': 200, 'data': departments}


def create_department(request):
    """POST /api/settings/departments"""
    data = parse_json_body(request.get('body', b''))
    name = data.get('name', '').strip()
    if not name:
        return {'status': 400, 'data': {'error': '部門名は必須です'}}

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO departments (name) VALUES (?)", (name,))
        conn.commit()
        dept_id = cursor.lastrowid
        conn.close()
        return {'status': 201, 'data': {'id': dept_id, 'name': name}}
    except Exception:
        conn.close()
        return {'status': 400, 'data': {'error': 'この部門名は既に存在します'}}


def update_department(request):
    """PUT /api/settings/departments/:id"""
    department_id = request['route_params']['department_id']
    data = parse_json_body(request.get('body', b''))
    name = data.get('name', '').strip()
    if not name:
        return {'status': 400, 'data': {'error': '部門名は必須です'}}

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE departments SET name = ? WHERE id = ?", (name, department_id))
    conn.commit()
    conn.close()
    return {'status': 200, 'data': {'id': int(department_id), 'name': name}}


def delete_department(request):
    """DELETE /api/settings/departments/:id"""
    department_id = request['route_params']['department_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM departments WHERE id = ?", (department_id,))
    conn.commit()
    conn.close()
    return {'status': 200, 'data': {'message': '部門を削除しました'}}


def get_stages(request):
    """GET /api/settings/stages"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, display_name, sort_order, is_active FROM selection_stages ORDER BY sort_order")
    stages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {'status': 200, 'data': stages}


def create_stage(request):
    """POST /api/settings/stages"""
    data = parse_json_body(request.get('body', b''))
    name = data.get('name', '').strip()
    display_name = data.get('display_name', '').strip()
    sort_order = data.get('sort_order', 0)

    if not name or not display_name:
        return {'status': 400, 'data': {'error': 'ステージ名は必須です'}}

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO selection_stages (name, display_name, sort_order) VALUES (?, ?, ?)",
        (name, display_name, sort_order)
    )
    conn.commit()
    stage_id = cursor.lastrowid
    conn.close()
    return {'status': 201, 'data': {'id': stage_id, 'name': name, 'display_name': display_name}}


def update_stage(request):
    """PUT /api/settings/stages/:id"""
    stage_id = request['route_params']['stage_id']
    data = parse_json_body(request.get('body', b''))

    conn = get_db()
    cursor = conn.cursor()

    updates = []
    values = []
    for field in ['name', 'display_name', 'sort_order', 'is_active']:
        if field in data:
            updates.append(f"{field} = ?")
            values.append(data[field])

    if updates:
        values.append(stage_id)
        cursor.execute(f"UPDATE selection_stages SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()

    conn.close()
    return {'status': 200, 'data': {'message': 'ステージを更新しました'}}


def get_system_info(request):
    """GET /api/settings/system"""
    conn = get_db()
    cursor = conn.cursor()

    counts = {}
    for table in ['jobs', 'candidates', 'applications', 'interviews', 'evaluations', 'users']:
        cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
        counts[table] = cursor.fetchone()['count']

    conn.close()
    return {
        'status': 200,
        'data': {
            'version': '1.0.0',
            'system_name': '採用管理システム (ATS)',
            'database': 'SQLite',
            'counts': counts
        }
    }
