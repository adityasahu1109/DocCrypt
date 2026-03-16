import sqlite3
import os

DB_REGISTRY = "trust_registry.db"
DB_USERS = "users.db"

def print_separator(title):
    print("\n" + "="*50)
    print(f" {title} ".center(50, "="))
    print("="*50 + "\n")

def view_registry():
    print_separator(f"DATABASE: {DB_REGISTRY} | TABLE: public_keys")
    if not os.path.exists(DB_REGISTRY):
        print(f"File {DB_REGISTRY} does not exist.")
        return
        
    conn = sqlite3.connect(DB_REGISTRY)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM public_keys")
        rows = cursor.fetchall()
        if not rows:
            print("[EMPTY TABLE] No keys registered.")
        else:
            for i, row in enumerate(rows):
                doc_id, jwk, created_at = row
                # Truncate JWK for readability in console
                short_jwk = jwk[:40] + "..." if len(jwk) > 40 else jwk
                print(f"[{i+1}] DocID: {doc_id} | Created: {created_at} | JWK: {short_jwk}")
    except sqlite3.OperationalError as e:
        print(f"Table error: {e}")
    finally:
        conn.close()

def view_users():
    print_separator(f"DATABASE: {DB_USERS} | TABLE: users")
    if not os.path.exists(DB_USERS):
        print(f"File {DB_USERS} does not exist.")
        return
        
    conn = sqlite3.connect(DB_USERS)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT email, user_type, first_name, last_name, org_name, contact_person, created_at FROM users")
        rows = cursor.fetchall()
        if not rows:
            print("[EMPTY TABLE] No users registered.")
        else:
            for i, row in enumerate(rows):
                email, user_type, first_name, last_name, org_name, contact_person, created_at = row
                
                print(f"[{i+1}] {email} ({user_type})")
                if user_type == "Individual":
                    print(f"    Name: {first_name} {last_name}")
                else:
                    print(f"    Org: {org_name} | Contact: {contact_person}")
                print(f"    Joined: {created_at}\n")
    except sqlite3.OperationalError as e:
        print(f"Table error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    view_registry()
    view_users()
    print("\nScript completed.")
