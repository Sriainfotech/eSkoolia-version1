#!/usr/bin/env python
"""
Diagnostic 2: Find ALL "School not found" error locations
Searches backend for all places returning this error
"""
import os
import re
from pathlib import Path

print("\n" + "="*80)
print("DIAGNOSTIC 2: FIND ALL 'SCHOOL NOT FOUND' ERROR LOCATIONS")
print("="*80)

backend_dir = Path(r"e:\Es_V1\eskoolia-v1\backend")
errors_found = []

print(f"\nSearching in: {backend_dir}")
print(f"Pattern: 'School not found' or similar error messages\n")

# Search for "School not found" in Python files
for py_file in backend_dir.rglob("*.py"):
    # Skip venv, __pycache__, migrations
    if any(skip in str(py_file) for skip in ['venv', '__pycache__', 'migrations', '.git']):
        continue
    
    try:
        content = py_file.read_text(encoding='utf-8', errors='ignore')
        lines = content.split('\n')
        
        for i, line in enumerate(lines, 1):
            # Search for error messages
            if 'school not found' in line.lower() or 'school.*not.*found' in line.lower():
                rel_path = py_file.relative_to(backend_dir)
                errors_found.append({
                    'file': rel_path,
                    'line': i,
                    'code': line.strip(),
                    'context': {
                        'before': lines[max(0, i-3):i-1] if i > 1 else [],
                        'after': lines[i:min(len(lines), i+3)]
                    }
                })
    except Exception as e:
        pass

print(f"Found {len(errors_found)} location(s):\n")

if errors_found:
    for idx, error in enumerate(errors_found, 1):
        print("-" * 80)
        print(f"{idx}. {error['file']}")
        print(f"   Line {error['line']}: {error['code']}")
        print()
        
        print("   Context:")
        for before_line in error['context']['before']:
            print(f"      {before_line}")
        print(f"   >>> {error['code']}")
        for after_line in error['context']['after']:
            print(f"      {after_line}")
        print()
else:
    print("No 'School not found' errors found in code")

# Also search for error patterns
print("\n" + "-"*80)
print("Search Summary:")
print("-"*80)

print(f"\nTotal locations with 'School not found': {len(errors_found)}")

for error in errors_found:
    print(f"  ✓ {error['file']}:{error['line']}")

print("\n" + "="*80)
print("END DIAGNOSTIC 2")
print("="*80)
