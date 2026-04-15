# app/models/__init__.py
# Export all models for easy import
from .base import *
from .user import User, UserCreate, UserLogin, Token
from .article import Article, ArticleCreate
from .event import Event, EventCreate
from .booking import Booking, BookingCreate
from .customer import Customer, CustomerCreate
from .invoice import Invoice, InvoiceCreate
from .maintenance import MaintenanceTask, MaintenanceTaskCreate
