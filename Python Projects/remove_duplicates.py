import os
import hashlib

def calculate_hash(file_path, hash_algo=hashlib.sha256):
    """
    Calculate the hash of a file using the specified hash algorithm:
    """
    hash_func = hash_algo()
    with open(file_path, 'rb') as file:
        for chunk in iter(lambda: file.read(4096), b''):
            hash_func.update(chunk)
    return hash_func.hexdigest()

def find_duplicate_files(folder_path):
    """
    Find and list duplicate files in the specified folder.
    """
    hashes = {}
    duplicates = []

    for dirpath, _, filenames in os.walk(folder_path):
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            file_hash = calculate_hash(file_path)

            if file_hash in hashes:
                duplicates.append(file_path)
            else:
                hashes[file_hash] = file_path
    return duplicates

def remove_deplicates_files(duplicates):
    """
    Remove duplicates files from the list.
    """
    for file_path in duplicates:
        os.remove(file_path)
        print(f"Removed duplicate files: {file_path}")

if __name__ == "__main__":
    folder_path = input("Enter the path of the folder to scan for duplicates: ").strip()

    if not os.path.isdir(folder_path):
        print("The specified path is not a valid directory.")
    else:
        duplicates = find_duplicate_files(folder_path)
        if duplicates:
            print("Duplicate files found:")
            for file in duplicates:
                print(file)
            remove_duplicates = input("Do you want to remove these duplicate files? (yes/no): ").strip().lower()
            if remove_duplicates == 'yes':
                remove_deplicates_files(duplicates)
                print("Duplicate files removed.")
            else:
                print("No files were removed.")
        else:
            print("No duplicate files found.")