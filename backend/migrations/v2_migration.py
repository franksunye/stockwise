import sys
import os

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection
from logger import logger

def migrate():
    logger.info("🚀 Starting V2 Database Migration...")
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 1. Create prediction_models table
        logger.info("📦 Creating 'prediction_models' table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prediction_models (
                model_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                provider TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                priority INTEGER DEFAULT 0,
                config_json TEXT,
                capabilities_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Seed initial models
        logger.info("🌱 Seeding prediction models...")
        models = [
            ('deepseek-v3', 'DeepSeek V3 (Cloud)', 'adapter-openai', 1, 100, '{"model": "deepseek-chat"}', '{"cost": "medium"}'),
            ('rule-engine', '量化规则引擎 (Base)', 'rule-engine', 1, 50, '{}', '{"cost": "zero"}'),
            ('legacy-ai', 'Legacy AI Records', 'legacy', 0, 0, '{}', '{}'),
            ('mock-dev', '开发测试 Mock', 'mock', 0, 0, '{}', '{}')
        ]
        
        for model in models:
            cursor.execute("""
                INSERT OR IGNORE INTO prediction_models 
                (model_id, display_name, provider, is_active, priority, config_json, capabilities_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, model)

        # 3. Create ai_predictions_v2 table
        logger.info("📦 Creating 'ai_predictions_v2' table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_predictions_v2 (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                model_id TEXT NOT NULL,
                
                target_date TEXT NOT NULL,
                signal TEXT,
                confidence REAL,
                support_price REAL,
                pressure_price REAL,
                ai_reasoning TEXT,
                
                prompt_version TEXT,
                token_usage_input INTEGER,
                token_usage_output INTEGER,
                execution_time_ms INTEGER,
                
                validation_status TEXT DEFAULT 'Pending',
                actual_change REAL,
                is_primary BOOLEAN DEFAULT 0,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                PRIMARY KEY (symbol, date, model_id),
                FOREIGN KEY (model_id) REFERENCES prediction_models(model_id)
            )
        """)

        # 4. Migrate data from ai_predictions to v2
        logger.info("🚚 Migrating legacy data to v2...")
        
        # Check if v2 is empty to avoid double migration
        cursor.execute("SELECT COUNT(*) FROM ai_predictions_v2")
        count_row = cursor.fetchone()
        
        # Robustly get the count value
        count = 0
        if isinstance(count_row, (tuple, list)):
            count = count_row[0]
        elif hasattr(count_row, '__getitem__'):
             try: count = count_row[0]
             except: count = 0
        elif hasattr(count_row, 'values'): 
             # For some row objects
             vals = list(count_row.values())
             if vals: count = vals[0]
        
        logger.info(f"📊 Current v2 count: {count}")
        
        if count == 0:
            # We migrate content. 
            # Note: old table might not have pressure_price, so check columns first or just assume defaults.
            # actually pressure_price was NOT in the old table schema shown in docs.
            
            cursor.execute("SELECT * FROM ai_predictions")
            columns = [description[0] for description in cursor.description]
            old_rows = cursor.fetchall()
            
            migrated_count = 0
            for row in old_rows:
                # Convert row to dict for easier access
                if isinstance(row, tuple):
                    data = dict(zip(columns, row))
                else: 
                     # Row object
                    data = {}
                    for col in columns:
                        data[col] = getattr(row, col) if hasattr(row, col) else row[columns.index(col)]

                # Map to new schema
                cursor.execute("""
                    INSERT INTO ai_predictions_v2 
                    (symbol, date, model_id, target_date, signal, confidence, support_price, ai_reasoning, 
                     validation_status, actual_change, is_primary, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    data.get('symbol'),
                    data.get('date'),
                    'legacy-ai', # model_id
                    data.get('target_date'),
                    data.get('signal'),
                    data.get('confidence'),
                    data.get('support_price'),
                    data.get('ai_reasoning'),
                    data.get('validation_status'),
                    data.get('actual_change'),
                    1, # is_primary (Legacy data is truth for now)
                    data.get('created_at'),
                    data.get('updated_at')
                ))
                migrated_count += 1
            
            logger.info(f"✅ Migrated {migrated_count} records to ai_predictions_v2")
        else:
            logger.info("⏩ v2 table already has data, skipping migration insert.")

        conn.commit()
        logger.info("✨ Migration completed successfully!")

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        # conn.rollback() # LibSQL adapter might not support rollback the same way, but let's try
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
