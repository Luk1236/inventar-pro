"""Pydantic data models — extracted verbatim from server.py (Phase 2 refactor).

Keine Logik-Änderungen, nur Struktur. Re-exportiert via
`from app.models import *` in server.py.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRole(str):
    ADMIN = "admin"
    LAGER = "lager"
    TECHNIKER = "techniker"
    VIEWER = "viewer"   # F12: read-only across all entities
    FAHRER = "fahrer"


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    role: str
    is_active: bool = True
    is_approved: bool = False  # New field for admin approval
    profile_image: Optional[str] = None  # Base64 profile image
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = UserRole.LAGER


class UserLogin(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class Token(BaseModel):
    access_token: str
    refresh_token: str  # NEW: Refresh token
    token_type: str
    user: User
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


_MAX_IMAGE_BYTES = 10 * 1024 * 1024


_MAX_IMAGES_PER_ARTICLE = 50


def _validate_image_base64(v: Optional[str]) -> Optional[str]:
    """Reject base64 images that exceed 10 MB (decoded size ≈ len*3/4)."""
    if v is None:
        return v
    estimated_bytes = len(v) * 3 // 4
    if estimated_bytes > _MAX_IMAGE_BYTES:
        raise ValueError("Bild überschreitet die maximale Größe von 10 MB")
    return v


def _validate_images_list(v: List[str]) -> List[str]:
    """Reject image lists with too many entries or oversized individual images."""
    if len(v) > _MAX_IMAGES_PER_ARTICLE:
        raise ValueError(f"Maximal {_MAX_IMAGES_PER_ARTICLE} Bilder erlaubt")
    for img in v:
        _validate_image_base64(img)
    return v


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    parent_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SupplierCreate(BaseModel):
    name: str = Field(..., max_length=255)
    contact_person: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=5000)


class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    members: List[str] = []  # List of user IDs
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str


class TeamCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    members: List[str] = []


class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str  # CREATE, UPDATE, DELETE, LOGIN, LOGOUT
    entity_type: str  # articles, customers, events, etc.
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    changes: Optional[dict] = None  # Before/after values
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Article(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    category_id: Optional[str] = None  # Made optional
    supplier_id: Optional[str] = None
    serial_number: Optional[str] = None
    inventory_code: Optional[str] = None
    base_unit: str = "Stück"
    current_stock: int = 0
    min_stock_level: int = 0
    price_per_unit: float = 0.0
    rental_price: Optional[float] = None  # Tagespreis
    # NEW: Gestaffelte Mietpreise
    rental_price_day: Optional[float] = None  # Tagespreis (1-3 Tage)
    rental_price_week: Optional[float] = None  # Wochenpreis (4-7 Tage)
    rental_price_month: Optional[float] = None  # Monatspreis (>7 Tage)
    # NEW: Equipment-spezifische Felder
    weight_kg: Optional[float] = None  # Gewicht in kg
    power_watt: Optional[int] = None  # Leistung in Watt
    power_type: Optional[str] = None  # "230V", "400V", "Akku", etc.
    operating_hours: Optional[float] = 0.0  # Betriebsstunden
    max_operating_hours: Optional[float] = None  # Max Stunden vor Wartung
    # Rental factors
    rental_factor_weekend: Optional[float] = 1.5  # Wochenend-Faktor
    rental_factor_week: Optional[float] = 3.0  # Wochen-Faktor
    # Consumable
    is_consumable: bool = False  # Ist Verbrauchsmaterial
    # Sub-Rental
    is_sub_rental: bool = False  # Ist Zumiet-Artikel
    sub_rental_supplier_id: Optional[str] = None  # Von wem gemietet
    sub_rental_cost: Optional[float] = None  # Mietkosten
    # Standard fields
    status: str = "OK"  # OK, defekt, gesperrt
    storage_location_id: Optional[str] = None  # Link to storage location
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    maintenance_interval_days: Optional[int] = None
    image_base64: Optional[str] = None  # Legacy single image
    images: List[str] = []  # Multiple images as base64 strings
    qr_code: Optional[str] = None
    archived: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ArticleCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    category_id: Optional[str] = None  # Made optional
    supplier_id: Optional[str] = None
    serial_number: Optional[str] = Field(None, max_length=100)
    inventory_code: Optional[str] = None
    base_unit: str = Field("Stück", max_length=50)
    current_stock: int = 0
    min_stock_level: int = 0
    price_per_unit: float = 0.0
    rental_price: Optional[float] = None
    # NEW: Gestaffelte Mietpreise
    rental_price_day: Optional[float] = None
    rental_price_week: Optional[float] = None
    rental_price_month: Optional[float] = None
    # NEW: Equipment-spezifische Felder
    weight_kg: Optional[float] = None
    power_watt: Optional[int] = None
    power_type: Optional[str] = Field(None, max_length=50)
    operating_hours: Optional[float] = 0.0
    max_operating_hours: Optional[float] = None
    rental_factor_weekend: Optional[float] = 1.5
    rental_factor_week: Optional[float] = 3.0
    is_consumable: bool = False
    is_sub_rental: bool = False
    sub_rental_supplier_id: Optional[str] = None
    sub_rental_cost: Optional[float] = None
    # Standard fields
    storage_location_id: Optional[str] = None  # Link to storage location
    maintenance_interval_days: Optional[int] = None
    image_base64: Optional[str] = None  # Legacy
    images: List[str] = []  # Multiple images

    @field_validator("image_base64", mode="before")
    @classmethod
    def validate_image_base64(cls, v):
        return _validate_image_base64(v)

    @field_validator("images", mode="before")
    @classmethod
    def validate_images(cls, v):
        return _validate_images_list(v)


class StorageZone(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # Innenlager, Sperrlager, Transport
    description: Optional[str] = None
    image_base64: Optional[str] = None  # Zone photo
    images: List[str] = []  # Multiple images
    qr_code: Optional[str] = None
    grid_width: Optional[int] = None   # Anzahl Felder in X-Richtung (1 Feld = 1,5 m)
    grid_depth: Optional[int] = None   # Anzahl Felder in Z-Richtung (1 Feld = 1,5 m)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StorageLocation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    zone_id: str
    name: str  # Regal-1, Fach-A, Case-123
    type: str  # Regal, Fach, Case, Container
    capacity: Optional[int] = None
    image_base64: Optional[str] = None  # Location photo
    images: List[str] = []  # Multiple images
    qr_code: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class InventoryMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    article_id: str
    movement_type: str  # IN, OUT, TRANSFER
    quantity: int
    from_location_id: Optional[str] = None
    to_location_id: Optional[str] = None
    user_id: str
    reason: Optional[str] = None
    reference_number: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MovementCreate(BaseModel):
    article_id: str
    movement_type: str = Field(..., max_length=20)
    quantity: int = Field(..., ge=1, le=100000)
    from_location_id: Optional[str] = None
    to_location_id: Optional[str] = None
    reason: Optional[str] = Field(None, max_length=1000)
    reference_number: Optional[str] = Field(None, max_length=100)


class MaintenanceTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    article_id: str
    title: str
    description: Optional[str] = None
    task_type: str  # routine, repair, inspection, dguv_v3
    priority: str = "medium"  # low, medium, high, critical
    status: str = "pending"  # pending, in_progress, completed, cancelled
    assigned_to: Optional[str] = None  # user_id
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_duration: Optional[int] = None  # minutes
    actual_duration: Optional[int] = None  # minutes
    created_by: str  # user_id
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MaintenanceTaskCreate(BaseModel):
    article_id: str
    title: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    task_type: str = Field("routine", max_length=50)
    priority: str = Field("medium", max_length=20)
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_duration: Optional[int] = None


class DGUVV3Inspection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    article_id: str
    inspection_date: datetime
    next_inspection_date: datetime
    inspector_name: str
    inspector_qualification: Optional[str] = None  # z.B. "Elektrofachkraft"
    inspection_type: str = "wiederkehrend"  # erstprüfung, wiederkehrend, prüfung_nach_reparatur
    result: str = "bestanden"  # bestanden, nicht_bestanden, bedingt_bestanden
    protocol_number: Optional[str] = None
    findings: Optional[List[str]] = None  # Liste der Mängel
    recommendations: Optional[str] = None
    measurement_values: Optional[Dict[str, Any]] = None  # z.B. {"schutzleiterwiderstand": 0.3, "iso_widerstand": 2.5}
    certificate_image: Optional[str] = None  # Base64 image of certificate
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str


class DGUVV3InspectionCreate(BaseModel):
    article_id: str
    inspection_date: datetime
    next_inspection_date: datetime
    inspector_name: str
    inspector_qualification: Optional[str] = None
    inspection_type: str = "wiederkehrend"
    result: str = "bestanden"
    protocol_number: Optional[str] = None
    findings: Optional[List[str]] = None
    recommendations: Optional[str] = None
    measurement_values: Optional[Dict[str, Any]] = None
    certificate_image: Optional[str] = None
    notes: Optional[str] = None


class RepairTicket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_number: str
    article_id: str
    title: str
    description: str
    defect_type: str = "other"  # electrical, mechanical, optical, software, other
    severity: str = "medium"  # low, medium, high, critical
    status: str = "open"  # open, in_progress, waiting_parts, repaired, closed, unrepairable
    reported_by: str
    assigned_to: Optional[str] = None
    defect_images: List[str] = []  # Base64 images of defects
    repair_images: List[str] = []  # Base64 images after repair
    repair_notes: Optional[str] = None
    parts_used: Optional[List[Dict[str, Any]]] = None
    repair_cost: Optional[float] = None
    repair_time_minutes: Optional[int] = None
    warranty_claim: bool = False
    external_repair: bool = False
    external_repair_vendor: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None


class RepairTicketCreate(BaseModel):
    article_id: str
    title: str = Field(..., max_length=255)
    description: str = Field(..., max_length=10000)
    defect_type: str = Field("other", max_length=50)
    severity: str = Field("medium", max_length=20)
    defect_images: List[str] = []
    warranty_claim: bool = False

    @field_validator("defect_images", mode="before")
    @classmethod
    def validate_defect_images(cls, v):
        return _validate_images_list(v)


class OperatingHoursUpdate(BaseModel):
    article_id: str
    hours_to_add: float
    notes: Optional[str] = None


class MaintenanceRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    article_id: str
    performed_by: str  # user_id
    work_description: str
    parts_used: Optional[List[Dict[str, Any]]] = None  # [{"name": "Filter", "quantity": 1, "cost": 25.50}]
    cost: Optional[float] = None
    before_images: Optional[List[str]] = None  # base64 images
    after_images: Optional[List[str]] = None  # base64 images
    next_maintenance_date: Optional[datetime] = None
    status_after: str = "OK"  # OK, defekt, gesperrt
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MaintenanceRecordCreate(BaseModel):
    task_id: str
    article_id: str
    work_description: str = Field(..., max_length=10000)
    parts_used: Optional[List[Dict[str, Any]]] = None
    cost: Optional[float] = None
    before_images: Optional[List[str]] = None
    after_images: Optional[List[str]] = None
    next_maintenance_date: Optional[datetime] = None
    status_after: str = Field("OK", max_length=20)
    notes: Optional[str] = Field(None, max_length=5000)


class MaintenanceChecklist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    category_ids: Optional[List[str]] = None  # applicable categories
    items: List[Dict[str, Any]]  # [{"title": "Check cables", "required": true, "type": "checkbox"}]
    created_by: str
    is_template: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MaintenanceChecklistCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    category_ids: Optional[List[str]] = None
    items: List[Dict[str, Any]]
    is_template: bool = True


class MaintenanceExecution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    checklist_id: str
    article_id: str
    performed_by: str
    checklist_results: List[Dict[str, Any]]  # completed checklist with results
    overall_status: str = "passed"  # passed, failed, partial
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MaintenanceExecutionCreate(BaseModel):
    task_id: str
    checklist_id: str
    article_id: str
    checklist_results: List[Dict[str, Any]]
    overall_status: str = "passed"
    notes: Optional[str] = None


class BundleItem(BaseModel):
    article_id: str
    quantity: int = 1
    is_optional: bool = False


class Bundle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    bundle_code: str  # z.B. "PA-SET-001"
    category: str = "Standard"  # PA, Licht, Video, Rigging, Strom, Sonstige
    items: List[BundleItem] = []
    # Calculated fields (stored for quick access)
    total_items: int = 0
    total_weight_kg: float = 0.0
    total_power_watt: int = 0
    rental_price_day: float = 0.0
    rental_price_week: float = 0.0
    rental_price_month: float = 0.0
    # Discount when booking as bundle
    bundle_discount_percent: float = 0.0  # z.B. 10% Rabatt als Paket
    # Status
    is_active: bool = True
    image_base64: Optional[str] = None
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str


class BundleCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    bundle_code: str = Field(..., max_length=100)
    category: str = Field("Standard", max_length=100)
    items: List[BundleItem] = []
    bundle_discount_percent: float = 0.0
    image_base64: Optional[str] = None

    @field_validator("image_base64", mode="before")
    @classmethod
    def validate_image_base64(cls, v):
        return _validate_image_base64(v)


class BundleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    items: Optional[List[BundleItem]] = None
    bundle_discount_percent: Optional[float] = None
    is_active: Optional[bool] = None
    image_base64: Optional[str] = None


class PackingListItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    booking_id: Optional[str] = None
    article_id: str
    quantity: int
    # Check-Out Status
    checked_out: bool = False
    checked_out_by: Optional[str] = None
    checked_out_at: Optional[datetime] = None
    checkout_condition: Optional[str] = None  # OK, note
    checkout_notes: Optional[str] = None
    # Check-In Status  
    checked_in: bool = False
    checked_in_by: Optional[str] = None
    checked_in_at: Optional[datetime] = None
    checkin_condition: Optional[str] = None  # OK, DIRTY, DEFECT, MISSING
    checkin_notes: Optional[str] = None
    checkin_photos: List[str] = []  # Base64 photos of damage
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PackingListCheckout(BaseModel):
    item_ids: List[str]  # IDs of items to check out
    condition: str = "OK"  # OK or note
    notes: Optional[str] = None


class PackingListCheckin(BaseModel):
    item_id: str
    condition: str = Field(..., max_length=20)  # OK, DIRTY, DEFECT, MISSING
    notes: Optional[str] = Field(None, max_length=2000)
    photos: List[str] = []


class ContactPerson(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_number: str  # Auto-generated
    company_name: str
    contact_person: str
    phone: str
    email: EmailStr
    address_street: Optional[str] = None
    address_zip: Optional[str] = None
    address_city: Optional[str] = None
    address_country: Optional[str] = "Deutschland"
    payment_terms: Optional[str] = None  # e.g., "14 Tage netto"
    contract_info: Optional[str] = None
    notes: Optional[str] = None
    contact_persons: List[ContactPerson] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CustomerCreate(BaseModel):
    company_name: str = Field(..., max_length=255)
    contact_person: str = Field(..., max_length=255)
    phone: str = Field(..., max_length=50)
    email: EmailStr
    address_street: Optional[str] = Field(None, max_length=255)
    address_zip: Optional[str] = Field(None, max_length=20)
    address_city: Optional[str] = Field(None, max_length=100)
    address_country: Optional[str] = Field("Deutschland", max_length=100)
    payment_terms: Optional[str] = Field(None, max_length=255)
    contract_info: Optional[str] = Field(None, max_length=5000)
    notes: Optional[str] = Field(None, max_length=5000)
    contact_persons: List[ContactPerson] = []


class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_number: str  # e.g., EVT-2025-001
    customer_id: str
    event_type: str  # Konzert, Messe, Hochzeit, etc.
    event_name: str
    description: Optional[str] = None
    location: str
    location_type: Optional[str] = None  # Indoor/Outdoor
    start_date: datetime
    end_date: datetime
    setup_date: Optional[datetime] = None
    teardown_date: Optional[datetime] = None
    status: str = "planned"  # planned, confirmed, in_progress, completed, cancelled
    total_value: Optional[float] = None
    notes: Optional[str] = None
    created_by: str  # user_id
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class EventCreate(BaseModel):
    customer_id: str
    event_type: str = Field(..., max_length=100)
    event_name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    location: str = Field(..., max_length=500)
    location_type: Optional[str] = Field(None, max_length=50)
    start_date: datetime
    end_date: datetime
    setup_date: Optional[datetime] = None
    teardown_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=10000)


class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    article_id: str
    quantity: int
    booked_by: str  # user_id
    status: str = "booked"  # booked, returned, cancelled
    pickup_date: Optional[datetime] = None
    return_date: Optional[datetime] = None
    notes: Optional[str] = None
    serial_number_ids: List[str] = []  # F3: assigned serial numbers
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BookingCreate(BaseModel):
    event_id: str
    article_id: str
    quantity: int
    pickup_date: Optional[datetime] = None
    return_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=2000)
    serial_number_ids: List[str] = []  # F3: pre-assign serial numbers at booking time

    @field_validator("return_date", mode="after")
    @classmethod
    def return_date_after_pickup(cls, v, info):
        pickup = info.data.get("pickup_date") if hasattr(info, "data") else None
        if v and pickup and v <= pickup:
            raise ValueError("return_date muss nach pickup_date liegen")
        return v

    @field_validator("quantity", mode="before")
    @classmethod
    def quantity_positive(cls, v):
        if v <= 0:
            raise ValueError("quantity muss größer als 0 sein")
        return v


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    recipient_id: str
    message_text: str
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MessageCreate(BaseModel):
    recipient_id: str
    message_text: str = Field(..., max_length=10000)


class MessageUpdate(BaseModel):
    message_text: str = Field(..., max_length=10000)


class Conversation(BaseModel):
    user_id: str
    username: str
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int = 0


class SettingsVersionHistory(BaseModel):
    version: int
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    changed_by: Optional[str] = None
    changes: dict = Field(default_factory=dict)


class AppSettings(BaseModel):
    # Version tracking
    settings_version: int = Field(1, ge=1)
    # Firmendaten
    company_name: str = Field("", max_length=255)
    company_logo: str = Field("", max_length=2000)  # Base64 or URL for company logo
    company_address: str = Field("", max_length=500)
    company_phone: str = Field("", max_length=50)
    company_email: str = Field("", max_length=255)
    company_website: str = Field("", max_length=500)
    # App Branding (Admin konfigurierbar)
    app_display_name: str = Field("Inventar Pro", max_length=100)
    app_logo_icon: str = Field("cube", max_length=50)  # Ionicons name: cube, cube-outline, archive, business, etc.
    app_primary_color: str = Field("#007AFF", max_length=20)
    app_slogan: str = Field("Professionelle Lagerverwaltung", max_length=200)
    # Nummernkreise
    invoice_prefix: str = Field("INV", max_length=10)
    quote_prefix: str = Field("QUO", max_length=10)
    event_prefix: str = Field("EVT", max_length=10)
    customer_prefix: str = Field("CUST", max_length=10)
    invoice_next_number: int = Field(1, ge=1)
    quote_next_number: int = Field(1, ge=1)
    # Finanzen
    tax_rate: float = Field(19.0, ge=0.0, le=100.0)
    currency: str = Field("EUR", max_length=10)
    payment_terms: List[str] = Field(default_factory=lambda: ["Sofort fällig", "14 Tage netto", "30 Tage netto"])
    payment_methods: List[str] = Field(default_factory=lambda: ["Bar", "Überweisung", "PayPal"])
    # Sonstige
    timezone: str = Field("Europe/Berlin", max_length=50)
    date_format: str = Field("DD.MM.YYYY", max_length=20)
    # Briefpapier
    letterhead_logo_url: str = Field("", max_length=2000)
    letterhead_primary_color: str = Field("#FF9500", max_length=20)
    letterhead_footer_text: str = Field("", max_length=500)
    letterhead_slogan: str = Field("", max_length=200)
    letterhead_show_logo: bool = True
    # Online-Angebote
    online_quotes_enabled: bool = True
    online_quotes_expiry_days: int = Field(30, ge=1, le=365)
    # Digitale Unterschrift
    signature_require_quotes: bool = False
    signature_require_delivery: bool = False
    signature_footer_text: Optional[str] = Field(None, max_length=500)
    # Online-Rechnungen
    online_invoices_enabled: bool = False
    online_invoices_expiry_days: int = Field(30, ge=1, le=365)
    online_invoices_payment_text: Optional[str] = Field(None, max_length=500)
    # Version history (stored as separate collection)
    version_history: List[SettingsVersionHistory] = Field(default_factory=list)


class InvoiceItem(BaseModel):
    article_id: str
    article_name: str
    quantity: int
    unit_price: float
    total_price: float


class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str  # Auto-generated
    event_id: Optional[str] = None
    customer_id: str
    items: List[InvoiceItem]
    subtotal: float
    tax_rate: float = 19.0  # 19% MwSt
    tax_amount: float
    total_amount: float
    notes: Optional[str] = None
    status: str = "draft"  # draft, sent, paid, cancelled
    payment_status: str = "offen"  # offen, teilweise, bezahlt, überfällig
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    public_token: Optional[str] = None


class InvoiceCreate(BaseModel):
    event_id: Optional[str] = None
    customer_id: Optional[str] = None
    notes: Optional[str] = None
    due_days: int = Field(14, ge=0, le=365)


class TimeEntryCreate(BaseModel):
    crew_member_id: str
    event_id: Optional[str] = None
    date: str                       # "2026-03-18"
    start_time: str                 # "08:00"
    end_time: str                   # "17:00"
    break_minutes: int = Field(0, ge=0, le=480)  # max 8h break
    activity: Optional[str] = None
    notes: Optional[str] = None


class TimeEntry(TimeEntryCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hours_worked: float = 0
    hourly_rate: float = 0
    total_pay: float = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class QuoteItem(BaseModel):
    article_id: Optional[str] = None
    article_name: str
    quantity: int = Field(1, ge=1, le=10000)
    unit_price: float = Field(0, ge=0)
    days: int = Field(1, ge=1, le=3650)  # max 10 years
    total: float = 0


class QuoteCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    event_name: str
    event_date: Optional[str] = None
    valid_until: Optional[str] = None
    items: List[QuoteItem] = []
    notes: Optional[str] = None
    discount_percent: float = Field(0, ge=0, le=100)


class Quote(QuoteCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quote_number: str = ""
    status: str = "entwurf"
    total_net: float = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BOMItem(BaseModel):
    article_id: str
    quantity: int
    is_optional: bool = False


class BillOfMaterials(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    category: Optional[str] = None  # Konzert, Messe, etc.
    items: List[BOMItem]
    package_price: Optional[float] = None  # Optional package discount price
    image_base64: Optional[str] = None
    is_active: bool = True
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BOMCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    items: List[BOMItem]
    package_price: Optional[float] = None
    image_base64: Optional[str] = None


class ProjectTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    event_type: Optional[str] = None
    location_type: Optional[str] = None
    notes_template: Optional[str] = None
    bom_id: Optional[str] = None


class ProjectTemplate(ProjectTemplateCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CustomFieldDefCreate(BaseModel):
    entity_type: str          # event | quote | customer | article
    field_label: str
    field_name: str
    field_type: str           # text | number | date | checkbox | select
    options: List[str] = []
    required: bool = False
    sort_order: int = 0


class CustomFieldDef(CustomFieldDefCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EventInvitationCreate(BaseModel):
    event_id: str
    email: str
    name: str = ""


class EventInvitation(EventInvitationCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"   # pending | accepted | declined
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None


class WebhookCreate(BaseModel):
    url: str
    events: List[str] = []   # e.g. event_created, booking_confirmed, invoice_created
    active: bool = True
    secret: str = ""


class Webhook(WebhookCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RentalCalculationRequest(BaseModel):
    article_ids: List[str]
    quantities: Dict[str, int] = {}


class ProfileUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=50)
    email: Optional[EmailStr] = None
    current_password: Optional[str] = Field(None, min_length=8, max_length=128)
    new_password: Optional[str] = Field(None, min_length=8, max_length=128)
    profile_image: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=128)


class ArticleImportRow(BaseModel):
    name: str
    inventory_code: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    base_unit: str = "Stück"
    current_stock: int = 0
    min_stock_level: int = 0
    price_per_unit: float = 0.0
    status: str = "OK"
    is_consumable: bool = False


class ArticleImportRequest(BaseModel):
    csv_content: str = ""   # raw CSV text (csv mode)
    file_content: str = ""  # F10: base64-encoded file bytes (excel mode)
    file_type: str = "csv"


class VehicleCreate(BaseModel):
    name: str
    license_plate: str = ""
    brand: str = ""
    model_name: str = ""
    year: Optional[int] = None
    tuev_date: Optional[str] = None
    fuel_type: str = "Diesel"
    status: str = "verfügbar"
    notes: Optional[str] = None


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    priority: str = "normal"
    due_date: Optional[str] = None
    event_id: Optional[str] = None
    event_name: Optional[str] = None
    status: str = "offen"


class Task(TaskCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = ""


class SerialNumberCreate(BaseModel):
    article_id: str
    article_name: str = ""
    serial_number: str
    status: str = "verfügbar"
    condition: str = "gut"
    purchase_date: Optional[str] = None
    purchase_price: Optional[float] = None
    notes: Optional[str] = None


class SerialNumber(SerialNumberCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AbsenceRequestCreate(BaseModel):
    crew_member_id: str
    crew_member_name: str = ""
    start_date: str
    end_date: str
    type: str = "urlaub"
    reason: Optional[str] = None
    status: str = "ausstehend"


class AbsenceRequest(AbsenceRequestCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StockCountItem(BaseModel):
    article_id: str
    article_name: str
    expected_quantity: int = 0
    counted_quantity: int = 0


class StockCountCreate(BaseModel):
    name: str
    notes: Optional[str] = None
    items: List[StockCountItem] = []


class StockCount(StockCountCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "offen"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = ""


class InspectionCreate(BaseModel):
    article_id: Optional[str] = None
    article_name: str = ""
    inspection_type: str = "Sicherheitsprüfung"
    due_date: str
    performed_date: Optional[str] = None
    performed_by: Optional[str] = None
    result: str = "ausstehend"
    next_due_date: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None


class Inspection(InspectionCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScanActionRequest(BaseModel):
    code: str = Field(..., max_length=500)
    action: str = Field(..., pattern="^(checkout|checkin|info)$")
    event_id: Optional[str] = None


class AssignSerialsRequest(BaseModel):
    serial_number_ids: List[str] = Field(..., min_length=1, max_length=200)


class PackingListSign(BaseModel):
    signature: str = Field(..., max_length=500_000)
    signed_by: str = Field(..., max_length=255)


class DeliveryConfirmation(BaseModel):
    signature: str  # Base64 SVG signature
    signed_by: str
    signed_at: str
    confirmed_items: List[str]


class PushTokenCreate(BaseModel):
    token: str
    platform: str = "ios"


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class DatabaseResetRequest(BaseModel):
    confirmation_phrase: str


class ArticleAvailability(BaseModel):
    article_id: str
    article_name: str
    inventory_code: str
    total_stock: int
    available_stock: int
    booked_quantity: int
    bookings: List[dict] = []


class AvailabilityCalendarEntry(BaseModel):
    date: str
    articles_booked: int
    total_booked_quantity: int
    events: List[dict] = []


class SubRentalArticle(BaseModel):
    id: str
    name: str
    inventory_code: str
    supplier_name: str
    supplier_id: str
    sub_rental_cost: float
    current_stock: int
    status: str


class SubRentalCreate(BaseModel):
    article_id: str
    supplier_id: str
    cost: float
    quantity: int = 1
    rental_start: Optional[datetime] = None
    rental_end: Optional[datetime] = None
    notes: Optional[str] = None
    event_id: Optional[str] = None
    billable_to_customer: bool = False


class SubRentalUpdate(BaseModel):
    cost: Optional[float] = None
    quantity: Optional[int] = None
    rental_start: Optional[datetime] = None
    rental_end: Optional[datetime] = None
    notes: Optional[str] = None
    event_id: Optional[str] = None
    billable_to_customer: Optional[bool] = None


class SubRental(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    article_id: str
    article_name: str
    supplier_id: str
    supplier_name: str
    cost: float
    quantity: int
    rental_start: Optional[datetime] = None
    rental_end: Optional[datetime] = None
    status: str = "requested"  # requested, confirmed, delivered, returned, cancelled
    event_id: Optional[str] = None
    billable_to_customer: bool = False
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str


class RentalContract(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contract_number: str
    event_id: str
    customer_id: str
    items: List[dict]
    start_date: datetime
    end_date: datetime
    subtotal: float
    tax_rate: float = 19.0
    tax_amount: float
    total_amount: float
    deposit_amount: float = 0.0
    status: str = "draft"  # draft, signed, active, completed, cancelled
    terms_accepted: bool = False
    signature_customer: Optional[str] = None  # Base64 signature
    signature_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str


class CrewMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str
    phone: Optional[str] = None
    email: Optional[str] = None
    hourly_rate: float = 0
    skills: List[str] = []
    is_available: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str
    license_plate: str
    capacity_kg: float = 0
    loading_meters: float = 0
    is_available: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CrewAssignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    crew_ids: List[str] = []
    vehicle_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PurchaseOrderItem(BaseModel):
    article_id: str = ""
    article_name: str = ""
    quantity: int = 1
    unit_price: float = 0.0
    total_price: float = 0.0


class PurchaseOrderCreate(BaseModel):
    supplier_id: Optional[str] = None
    supplier_name: str = ""
    order_date: Optional[str] = None
    expected_delivery: Optional[str] = None
    status: str = "offen"  # offen | bestellt | teilweise_geliefert | geliefert | storniert
    items: List[PurchaseOrderItem] = []
    notes: Optional[str] = None
    total_amount: float = 0.0


class PurchaseOrder(PurchaseOrderCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = ""


class ActivityCreate(BaseModel):
    title: str
    description: Optional[str] = None
    crew_member_id: Optional[str] = None
    crew_member_name: str = ""
    event_id: Optional[str] = None
    event_name: str = ""
    date: str  # YYYY-MM-DD
    duration_hours: float = 0.0
    activity_type: str = "allgemein"  # allgemein | auf_und_abbau | transport | probe | veranstaltung
    status: str = "geplant"


class Activity(ActivityCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CrossDockingCreate(BaseModel):
    article_id: str
    article_name: str = ""
    quantity: int = 1
    source_event_id: Optional[str] = None
    source_event_name: str = ""
    target_event_id: Optional[str] = None
    target_event_name: str = ""
    transfer_date: Optional[str] = None
    status: str = "geplant"  # geplant | bereit | übertragen | abgebrochen
    notes: Optional[str] = None


class CrossDocking(CrossDockingCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JobBoardEntryCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_id: Optional[str] = None
    event_name: str = ""
    assigned_to_id: Optional[str] = None
    assigned_to_name: str = ""
    job_type: str = "aufbau"  # aufbau | abbau | transport | technik | sonstiges
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: str = ""
    status: str = "offen"


class JobBoardEntry(JobBoardEntryCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CommunicationLogCreate(BaseModel):
    type: str = "email"  # email | note | sms | anruf
    direction: str = "ausgehend"  # ausgehend | eingehend
    subject: str = ""
    body: str = ""
    recipient: str = ""
    sender: str = ""
    customer_id: Optional[str] = None
    customer_name: str = ""
    event_id: Optional[str] = None
    event_name: str = ""
    sent_at: Optional[str] = None
    status: str = "gesendet"


class CommunicationLog(CommunicationLogCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = ""


class RentalRequestCreate(BaseModel):
    customer_name: str
    customer_email: str = ""
    customer_phone: str = ""
    event_name: str = ""
    event_date: Optional[str] = None
    event_location: str = ""
    description: str = ""
    status: str = "neu"  # neu | in_bearbeitung | angebot_gesendet | bestaetigt | abgelehnt
    notes: str = ""


class RentalRequest(RentalRequestCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = ""
