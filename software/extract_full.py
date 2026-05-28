from docx import Document
import json

doc = Document(r'd:\2026比赛\26软件杯相关\software\示范景区公开资料包\灵山胜境 景点结构化数据集.docx')

# Extract all text
all_text = []
for para in doc.paragraphs:
    if para.text.strip():
        all_text.append(para.text.strip())

# Print full content
for text in all_text:
    print(text)
    print("-" * 80)