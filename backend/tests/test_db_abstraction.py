import sys
import os
import unittest

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection, LibSQLCursorAdapter

def get_table_columns(cursor, table_name):
    """
    Standardized way to get column names regardless of driver.
    This effectively abstracts the difference between sqlite3 and libsql.
    """
    cursor.execute(f"PRAGMA table_info({table_name})")
    rows = cursor.fetchall()
    
    columns = []
    for row in rows:
        # Strategy 1: SQLite3 (returns tuple, index 1 is name)
        if isinstance(row, tuple):
            columns.append(row[1])
        # Strategy 2: LibSQL Row Object (has .name attribute)
        elif hasattr(row, 'name'):
            columns.append(row.name)  # Note: verify if it's .name or ["name"]
        # Strategy 3: LibSQL Dict-like
        elif hasattr(row, '__getitem__'):
             try:
                 columns.append(row['name'])
             except:
                 # Fallback for some row objects behaving like lists
                 columns.append(row[1])
        else:
            print(f"⚠️ Unknown Row Type: {type(row)}")
            
    return columns

class TestDBAbstraction(unittest.TestCase):
    def setUp(self):
        self.conn = get_connection()
        self.cursor = self.conn.cursor()
        
    def tearDown(self):
        self.conn.close()

    def test_stock_meta_columns(self):
        print(f"\n🔍 Testing connection type: {type(self.conn)}")
        
        # Ensure table exists
        self.cursor.execute("CREATE TABLE IF NOT EXISTS test_schema_abstraction (id INTEGER, test_col TEXT)")
        
        cols = get_table_columns(self.cursor, "test_schema_abstraction")
        print(f"   Detected Columns: {cols}")
        
        self.assertIn("id", cols)
        self.assertIn("test_col", cols)
        
        # Clean up
        self.cursor.execute("DROP TABLE test_schema_abstraction")

if __name__ == "__main__":
    unittest.main()
