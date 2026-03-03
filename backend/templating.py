from jinja2 import Environment, FileSystemLoader, select_autoescape
import os

# 配置 Jinja2 环境
template_dir = os.path.join(os.path.dirname(__file__), 'templates')
env = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=False # Disable autoescape for Prompts (Text/Markdown)
)

import re

def render_template(template_name: str, **kwargs) -> str:
    """即時渲染指定的模板"""
    template = env.get_template(template_name)
    return template.render(**kwargs)

def get_template_version(template_name: str, default: str = "v1") -> str:
    """
    Extracts version metadata from the first line of the template.
    Expected format: {# version: v2.0 #}
    """
    try:
        source, _, _ = env.loader.get_source(env, template_name)
        match = re.search(r'\{#\s*version:\s*(.*?)\s*#\}', source)
        if match:
            return match.group(1).strip()
    except Exception:
        pass
    return default
