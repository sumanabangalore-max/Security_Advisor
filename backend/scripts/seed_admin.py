import sys
import os
import random
import string

# Add parent directories to sys.path to resolve imports correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app.models import User, Role
from app.auth import get_password_hash

def generate_random_password(length=12):
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(length))

def seed_admin():
    db = SessionLocal()
    try:
        # Ensure role exists
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            # Seed roles if they do not exist
            for role_name in ["admin", "analyst", "viewer"]:
                if not db.query(Role).filter(Role.name == role_name).first():
                    db.add(Role(name=role_name))
            db.commit()

        # Check if admin already exists
        admin_user = db.query(User).filter(User.username == "admin").first()
        if admin_user:
            print("Admin user 'admin' already exists in the database. Skipping creation.")
            return

        password = generate_random_password()
        hashed = get_password_hash(password)

        new_admin = User(
            username="admin",
            hashed_password=hashed,
            role="admin"
        )
        db.add(new_admin)
        db.commit()

        print("=" * 60)
        print("SEED ADMIN: Admin user created successfully.")
        print(f"Username: admin")
        print(f"Password: {password}")
        print("CRITICAL: Save this password! It is printed once and NEVER stored in plaintext.")
        print("=" * 60)

    except Exception as e:
        print(f"Failed to seed admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
