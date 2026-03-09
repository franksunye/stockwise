import os
import sys


root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, "backend"))

from backend.database import get_connection


def verify_data() -> None:
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT p.model_id, m.display_name, p.date, p.target_date, p.is_primary
        FROM ai_predictions_v2 p
        LEFT JOIN prediction_models m ON p.model_id = m.model_id
        WHERE p.symbol = '00700' AND p.date = '2026-01-02'
        ORDER BY p.created_at DESC
    """

    cursor.execute(query)
    rows = cursor.fetchall()

    print(f"{'Model ID':<20} | {'Display Name':<20} | {'Date':<12} | {'Target Date':<12} | {'Primary':<7}")
    print("-" * 80)

    for row in rows:
        print(f"{str(row[0]):<20} | {str(row[1]):<20} | {str(row[2]):<12} | {str(row[3]):<12} | {str(row[4]):<7}")

    conn.close()


if __name__ == "__main__":
    verify_data()
