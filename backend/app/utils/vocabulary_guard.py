import re

def apply_vocabulary_guard(text: str) -> str:
    if not text:
        return text
        
    replacements = [
        (r'\b(buy|buying)\b', 'consider'),
        (r'\b(sell|selling)\b', 're-evaluate'),
        (r'\b(recommend|recommends|recommending|recommendation)\b', 'highlight'),
        (r'\b(should buy|should sell)\b', 'might fit your criteria'),
        (r'\b(best stock|top stock)\b', 'strong match'),
        (r'\b(guaranteed|sure thing)\b', 'historically aligned')
    ]
    
    sanitized = text
    for pattern, repl in replacements:
        sanitized = re.sub(pattern, repl, sanitized, flags=re.IGNORECASE)
        
    return sanitized
