import json
from typing import Dict, Any, Type
from .base import BasePredictionModel
from backend.database import get_connection

class ModelFactory:
    _registry: Dict[str, Type[BasePredictionModel]] = {}
    
    @classmethod
    def register(cls, provider_type: str, model_class: Type[BasePredictionModel]):
        cls._registry[provider_type] = model_class
        
    @classmethod
    def create_model(cls, model_id: str) -> BasePredictionModel:
        # 1. Fetch config from DB
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM prediction_models WHERE model_id = ?", (model_id,))
            # Adapt to row format
            row = cursor.fetchone()
        finally:
            conn.close()
        
        if not row:
            raise ValueError(f"Model ID '{model_id}' not found in registry.")
            
        # Convert row to dict robustly
        columns = [d[0] for d in cursor.description]
        if isinstance(row, (tuple, list)):
            row_dict = dict(zip(columns, row))
        elif hasattr(row, 'keys'):
            # Works for sqlite3.Row / mapping
            row_dict = dict(row)
        else:
            # Fallback for libsql Row object which might be indexable
            # Try to zip with columns assuming order matches
            try:
                row_dict = dict(zip(columns, row))
            except:
                # Last resort if it has attributes matching columns (unlikely given previous error)
                # Or maybe it has .as_dict() ?
                # Start with empty
                row_dict = {}
                # Try iterating columns and getting attr
                for col in columns:
                     try: row_dict[col] = getattr(row, col)
                     except: 
                        # Try get item
                        try: row_dict[col] = row[columns.index(col)]
                        except: pass

        provider = row_dict.get('provider')
        config_json = row_dict.get('config_json') or '{}'
        capabilities_json = row_dict.get('capabilities_json') or '{}'
        display_name = row_dict.get('display_name')

             
        config = json.loads(config_json)
        config['capabilities_json'] = json.loads(capabilities_json)
        config['display_name'] = display_name
        
        # 2. Instantiate
        model_class = cls._registry.get(provider)
        if not model_class:
            raise ValueError(f"Provider '{provider}' not supported (Available: {list(cls._registry.keys())})")
            
        return model_class(model_id, config)

    @classmethod
    def get_active_models(cls):
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT model_id FROM prediction_models WHERE is_active = 1 ORDER BY priority DESC")
            rows = cursor.fetchall()
        finally:
            conn.close()
        
        models = []
        for row in rows:
            # Robustly access first column (model_id)
            if isinstance(row, (tuple, list)):
                mid = row[0]
            elif hasattr(row, '__getitem__'):
                mid = row[0]
            else:
                 # Try attribute if named row
                 mid = getattr(row, 'model_id', None)
                 
            if mid:
                try:
                    models.append(cls.create_model(mid))
                except Exception as e:
                    print(f"⚠️ Failed to load model {mid}: {e}")
        return models
