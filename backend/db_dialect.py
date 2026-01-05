from sqlalchemy.dialects.sqlite.base import SQLiteDialect
import libsql

class LibSQLDialect(SQLiteDialect):
    """
    LibSQL 专用方言，基于最基础的 SQLiteDialect。
    完全避开 SQLiteDialect_pysqlite (由于它会强制调用 create_function)。
    """
    driver = 'libsql'
    supports_statement_cache = True
    
    @classmethod
    def import_dbapi(cls):
        return libsql

    def on_connect(self):
        # 显式返回 None，确保没有任何连接钩子被注册
        return None
