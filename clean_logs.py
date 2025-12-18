#!/usr/bin/env python3
"""
Clean debug logging from priorityService.ts
- Remove ALL logger.info() lines with emojis or === markers
- Remove emoji prefixes from logger.error() and logger.warn()
- Keep essential logger.info() without emojis
"""

import re
import sys

def clean_logger_line(line):
    """
    Clean a single line:
    - If logger.info with emoji/===, return None to delete
    - If logger.error/warn with emoji, remove emoji
    - Otherwise, return line as-is
    """
    # List of emojis to check for
    emojis = ['🎯', '✅', '📊', '📋', '📭', '⚠️', '❌', '🔍', '🧪', '🔓',
              '📦', '🔑', '🔗', '📅', '🏥', '🏢', '🌱', '👤', '📄', '🌐', '➕']

    # Check if line contains logger.info with emoji or ===
    if 'logger.info' in line:
        # Check for === markers
        if '===' in line:
            return None
        # Check for any emoji
        if any(emoji in line for emoji in emojis):
            return None

    # For logger.error and logger.warn, remove emoji prefixes
    if 'logger.error' in line or 'logger.warn' in line:
        # Remove emoji prefixes like "❌ " or "⚠️ "
        for emoji in emojis:
            # Pattern: emoji followed by space at start of message
            line = re.sub(rf'(`{emoji}\s+)', r'`', line)
            line = re.sub(rf'(\'{emoji}\s+)', r"'", line)
            line = re.sub(rf'(\"{emoji}\s+)', r'"', line)

    return line

def clean_file(input_path, output_path):
    """Clean the TypeScript file"""
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    cleaned_lines = []
    removed_count = 0

    for line in lines:
        cleaned = clean_logger_line(line)
        if cleaned is None:
            removed_count += 1
        else:
            cleaned_lines.append(cleaned)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(cleaned_lines)

    print(f"Removed {removed_count} debug logger.info() lines")
    print(f"Output written to {output_path}")

if __name__ == '__main__':
    input_file = r'c:\Users\amitaik\Desktop\ala-improved\backend\src\services\priorityService.ts'
    output_file = r'c:\Users\amitaik\Desktop\ala-improved\backend\src\services\priorityService.ts.cleaned'

    clean_file(input_file, output_file)
