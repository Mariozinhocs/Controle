import json
import re

filepath = r"C:\Users\mario\.gemini\antigravity-ide\brain\884d4daf-224b-40f7-9c65-48ecca0922a8\.system_generated\steps\2162\content.md"

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Extract json
# The file has markdown frontmatter/title, then json starts after the --- delimiter.
json_start = text.find('{')
json_data = json.loads(text[json_start:])

custom_reqs = json.loads(json_data['configuracoes'][0]['custom_requisicoes'])

lotes = {}
for item in custom_reqs:
    match = re.search(r'\((.*?)\)', item)
    lote = match.group(1).strip() if match else 'NONE'
    lotes[lote] = lotes.get(lote, 0) + 1

print("Lotes in custom_requisicoes:")
print(lotes)
