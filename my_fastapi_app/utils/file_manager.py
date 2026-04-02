import os
import glob

def delete_physical_file(image_path: str):
    if not image_path:
        return
    
    # Check if the path is a file reference rather than base64
    if image_path.startswith('/static/'):
        # Map '/static/' to the actual directory 'front end/user module/'
        relative_path = image_path.replace('/static/', 'front end/user module/', 1)
        
        # Determine the absolute path since the app might be run from a different directory
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Combine them safely, taking care of OS-specific separators
        full_path = os.path.join(base_dir, relative_path.replace('/', os.sep))
        
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                print(f"Deleted physical file: {full_path}")
            except Exception as e:
                print(f"Error deleting physical file at {full_path}: {e}")
                
        # Handle input video deletion if this was an output video
        filename = os.path.basename(full_path)
        directory = os.path.dirname(full_path)
        
        if filename.startswith('output_'):
            # Extract base_name: strip 'output_' prefix and the extension
            base_name_str = filename[len('output_'):]
            base_name = os.path.splitext(base_name_str)[0]
            
            search_pattern = os.path.join(directory, f"input_{base_name}.*")
            matching_files = glob.glob(search_pattern)
            for input_file in matching_files:
                try:
                    if os.path.exists(input_file):
                        os.remove(input_file)
                        print(f"Deleted associated input video: {input_file}")
                except Exception as e:
                    print(f"Error deleting input video at {input_file}: {e}")
