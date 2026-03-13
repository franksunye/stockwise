import math
import unittest

from backend.database import TursoHttpCursor


class _DummyConn:
    def _send(self, payload):
        self.payload = payload
        return {"results": [{"type": "ok", "response": {"type": "execute", "result": {"affected_row_count": 0}}}]}


class TestTursoHttpCursorEncoding(unittest.TestCase):
    def test_non_finite_floats_are_sent_as_null(self):
        conn = _DummyConn()
        cursor = TursoHttpCursor(conn)

        cursor.execute(
            "UPDATE t SET a = ?, b = ?, c = ?, d = ?",
            (math.nan, math.inf, -math.inf, 1.23),
        )

        args = conn.payload["requests"][0]["stmt"]["args"]
        self.assertEqual(args[0], {"type": "null", "value": None})
        self.assertEqual(args[1], {"type": "null", "value": None})
        self.assertEqual(args[2], {"type": "null", "value": None})
        self.assertEqual(args[3], {"type": "float", "value": 1.23})
