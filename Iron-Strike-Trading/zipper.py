import os
import zipfile

def zip_project(output_filename="iron_strike_source.zip"):
    # Files to include
    extensions = {'.py', '.json', '.txt', '.md'}
    # Folders to ignore completely
    ignored_folders = {'venv', '.pythonlibs', '__pycache__', '.git', '.upm'}
    
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        print(f"📦 Zipping project into {output_filename}...")
        for root, dirs, files in os.walk("."):
            # Remove ignored folders from the traversal
            dirs[:] = [d for d in dirs if d not in ignored_folders]
            
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    file_path = os.path.join(root, file)
                    # Don't zip the zipper itself or the output zip
                    if file == "zipper.py" or file == output_filename:
                        continue
                        
                    print(f"  + Adding: {file_path}")
                    zipf.write(file_path, arcname=os.path.relpath(file_path, "."))
    
    print(f"\n✅ Success! Download '{output_filename}' from the file list.")

if __name__ == "__main__":
    zip_project()
