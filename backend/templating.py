from jinja2 import Environment, FileSystemLoader, select_autoescape
import os

# 配置 Jinja2 环境
template_dir = os.path.join(os.path.dirname(__file__), 'templates')
env = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=select_autoescape(['html', 'xml', 'j2'])
)

def render_template(template_name: str, **kwargs) -> str:
    """即時渲染指定的模板"""
    template = env.get_template(template_name)
    return template.render(**kwargs)
