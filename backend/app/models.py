from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.sql import func
from .database import Base

class Role(Base):
    __tablename__ = "roles"
    name = Column(String(50), primary_key=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), ForeignKey("roles.name"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MasterInventory(Base):
    __tablename__ = "master_inventory"
    id = Column(Integer, primary_key=True, index=True)
    software_name = Column(String(255), nullable=False)
    version = Column(String(100), nullable=False)
    environment = Column(String(100), nullable=False, default="Production")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class LiveCVE(Base):
    __tablename__ = "live_cves"
    cve_id = Column(String(50), primary_key=True)
    summary = Column(Text, nullable=False)
    cvss_score = Column(Numeric(3, 1))
    published_date = Column(DateTime(timezone=True), nullable=False)
    last_modified = Column(DateTime(timezone=True), nullable=False)
    software_name = Column(String(255), nullable=False)
    version_affected = Column(String(100), nullable=False)
    cpe23 = Column(String(255))

class VulnerabilityLifecycle(Base):
    __tablename__ = "vulnerability_lifecycle"
    id = Column(Integer, primary_key=True, index=True)
    cve_id = Column(String(50), ForeignKey("live_cves.cve_id", ondelete="CASCADE"), nullable=False)
    software_id = Column(Integer, ForeignKey("master_inventory.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False, default="Open")  # Open, False Positive, Mitigated
    assigned_engineer = Column(String(255))
    remediation_steps = Column(Text)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("cve_id", "software_id", name="uq_cve_software"),)
