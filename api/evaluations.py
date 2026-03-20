import json
from datetime import datetime
from database import get_db
from server import parse_json_body, get_pagination_params, convert_keys_to_camel


def register_routes(router):
    """Register evaluation-related routes"""
    router.get(r'/api/evaluations', list_evaluations)
    router.get(r'/api/evaluations/(?P<evaluation_id>\d+)', get_evaluation)
    router.post(r'/api/evaluations', create_evaluation)
    router.get(r'/api/interviews/(?P<interview_id>\d+)/evaluations', get_interview_evaluations)


def list_evaluations(request):
    """GET /api/evaluations - List evaluations by candidate"""
    conn = get_db()
    cursor = conn.cursor()

    # Get unique candidates with their evaluations
    cursor.execute("""
        SELECT DISTINCT a.candidate_id as candidateId, c.name as candidateName,
               AVG(e.overall_score) as averageScore
        FROM candidates c
        LEFT JOIN applications a ON c.id = a.candidate_id
        LEFT JOIN interviews i ON a.id = i.application_id
        LEFT JOIN evaluations e ON i.id = e.interview_id
        GROUP BY a.candidate_id, c.name
        ORDER BY c.created_at DESC
    """)

    evaluations = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Convert to camelCase and return as array
    evaluations = convert_keys_to_camel(evaluations)

    return {
        'status': 200,
        'data': evaluations
    }


def get_evaluation(request):
    """GET /api/evaluations/:id - Get evaluation detail"""
    evaluation_id = request['route_params']['evaluation_id']

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT e.*, i.application_id, a.candidate_id, c.name as candidate_name,
               j.title as job_title, j.department
        FROM evaluations e
        JOIN interviews i ON e.interview_id = i.id
        JOIN applications a ON i.application_id = a.id
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
        WHERE e.id = ?
    """, (evaluation_id,))

    evaluation = cursor.fetchone()

    if not evaluation:
        conn.close()
        return {'status': 404, 'data': {'error': 'Evaluation not found'}}

    conn.close()

    return {'status': 200, 'data': dict(evaluation)}


def create_evaluation(request):
    """POST /api/evaluations - Create new evaluation"""
    data = parse_json_body(request['body'])

    # Validate required fields
    if 'interview_id' not in data:
        return {'status': 400, 'data': {'error': 'interview_id is required'}}

    conn = get_db()
    cursor = conn.cursor()

    interview_id = data['interview_id']

    # Verify interview exists
    cursor.execute("SELECT id FROM interviews WHERE id = ?", (interview_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Interview not found'}}

    cursor.execute("""
        INSERT INTO evaluations (interview_id, evaluator_name, technical_score,
                                communication_score, culture_fit_score, motivation_score,
                                overall_score, strengths, weaknesses, recommendation, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        interview_id,
        data.get('evaluator_name'),
        data.get('technical_score'),
        data.get('communication_score'),
        data.get('culture_fit_score'),
        data.get('motivation_score'),
        data.get('overall_score'),
        data.get('strengths', ''),
        data.get('weaknesses', ''),
        data.get('recommendation'),
        data.get('comments', '')
    ))

    evaluation_id = cursor.lastrowid

    # Log activity
    cursor.execute("""
        INSERT INTO activities (entity_type, entity_id, action, description, user_name)
        VALUES (?, ?, ?, ?, ?)
    """, ('evaluation', evaluation_id, 'created', f'Evaluation created for interview {interview_id}', 'System'))

    conn.commit()
    conn.close()

    return {
        'status': 201,
        'data': {'id': evaluation_id, 'message': 'Evaluation created successfully'}
    }


def get_interview_evaluations(request):
    """GET /api/interviews/:id/evaluations - Get evaluations for an interview"""
    interview_id = request['route_params']['interview_id']

    conn = get_db()
    cursor = conn.cursor()

    # Verify interview exists
    cursor.execute("SELECT id FROM interviews WHERE id = ?", (interview_id,))
    if not cursor.fetchone():
        conn.close()
        return {'status': 404, 'data': {'error': 'Interview not found'}}

    # Get evaluations
    cursor.execute("""
        SELECT * FROM evaluations
        WHERE interview_id = ?
        ORDER BY created_at DESC
    """, (interview_id,))

    evaluations = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        'status': 200,
        'data': {'evaluations': evaluations}
    }
