import os
import json
import re

base_dir = r"c:\Users\darla\OneDrive\Desktop\eskoolia3\frontend"
json_file = r"c:\Users\darla\OneDrive\Desktop\eskoolia3\frontend_files.json"
output_md = r"C:\Users\darla\.gemini\antigravity-ide\brain\521e927c-5213-4fff-b278-37ff17ee9ed7\highly_detailed_frontend_analysis.md"

with open(json_file, "r") as f:
    files = json.load(f)
files.sort()

def extract_file_details(filepath):
    full_path = os.path.join(base_dir, filepath)
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return "Unable to read file contents."

    details = []
    lower_path = filepath.lower()

    # 1. Check for backend connections / API calls
    api_calls = re.findall(r"(axios\.(?:get|post|put|delete|patch)\(['`\"](.*?)['`\"]|fetch\(['`\"](.*?)['`\"])", content)
    imported_apis = re.findall(r"import\s+.*?from\s+['\"](.*?(?:api|services).*?)['\"]", content)
    
    if api_calls or imported_apis:
        api_text = "🔌 **Backend Connection:** "
        if api_calls:
            endpoints = [match[1] or match[2] for match in api_calls[:3]]
            api_text += f"Makes direct API calls (e.g., to `{', '.join(endpoints)}`). "
        if imported_apis:
            api_text += f"Imports API functions from `{', '.join(imported_apis[:3])}`."
        details.append(api_text)

    # 2. Extract Exports (what this file provides to others)
    exports = re.findall(r"export (?:default )?(?:function|const|class|interface|type) ([a-zA-Z0-9_]+)", content)
    if exports:
        details.append(f"📦 **Exports:** `{', '.join(exports[:5])}`" + (" (and more)" if len(exports) > 5 else ""))

    # 3. Determine specific role
    if "app/" in lower_path:
        if filepath.endswith("page.tsx"):
            details.append("🖥️ **Role:** This is a Next.js Page. It represents the UI that the user sees when they navigate to this specific URL route.")
        elif filepath.endswith("layout.tsx"):
            details.append("🏗️ **Role:** This is a Next.js Layout. It wraps around pages (typically containing Sidebars, Navbars, or global wrappers).")
        elif filepath.endswith("route.ts"):
            details.append("⚙️ **Role:** Next.js Backend API Route. Handles server-side logic and requests.")
    elif "components/" in lower_path:
        # Check what UI elements it renders
        rendered_elements = re.findall(r"<([A-Z][a-zA-Z0-9_]+)", content)
        unique_elements = list(set(rendered_elements))
        details.append(f"🧩 **Role:** React UI Component. It renders visual elements on the screen.")
        if unique_elements:
            details.append(f"🎨 **Renders sub-components:** `{', '.join(unique_elements[:5])}`.")
    elif "lib/" in lower_path:
        details.append("🛠️ **Role:** Core Library File. Contains business logic, API communication setups, or utility functions that don't directly render UI.")
    elif "hooks/" in lower_path:
        state_vars = re.findall(r"const \[(.*?), set.*?\] = useState", content)
        details.append(f"🪝 **Role:** Custom React Hook. Manages complex state or data fetching logic so components stay clean.")
        if state_vars:
            details.append(f"🧠 **Manages state for:** `{', '.join(state_vars[:3])}`.")
    elif "contexts/" in lower_path:
        details.append("🌐 **Role:** React Context. Holds global data (like User Authentication, Theme, or Permissions) that multiple different pages need to access simultaneously.")
    
    # 4. Fallback if still empty
    if not details:
        if filepath.endswith(".css"):
            return "🎨 **Role:** CSS Stylesheet. Defines the colors, spacing, and visual design rules."
        if filepath.endswith(".json"):
            return "📄 **Role:** Configuration or Static Data File (JSON format)."
        return "📁 **Role:** General script or configuration file."

    return "\n  ".join(details)

# Group files
grouped_files = {}
for f in files:
    parts = f.replace("\\", "/").split("/")
    if len(parts) > 1:
        if parts[0] in ["app", "components"]:
            group = f"{parts[0]}/{parts[1]}" if len(parts) > 1 else parts[0]
        else:
            group = parts[0]
    else:
        group = "Root Config Files"
        
    if group not in grouped_files:
        grouped_files[group] = []
    grouped_files[group].append(f)

with open(output_md, "w", encoding="utf-8") as md:
    md.write("# Highly Detailed Frontend File Analysis\n\n")
    md.write("This document parses the actual code inside each file to tell you exactly what it does, what it exports, and how it connects to the backend.\n\n")
    
    for group in sorted(grouped_files.keys()):
        md.write(f"## Directory: `{group}`\n\n")
        
        for file in grouped_files[group]:
            desc = extract_file_details(file)
            file_forward_slash = file.replace("\\", "/")
            md.write(f"### `{file_forward_slash}`\n")
            md.write(f"  {desc}\n\n")

print("Generated Highly Detailed MD file.")
