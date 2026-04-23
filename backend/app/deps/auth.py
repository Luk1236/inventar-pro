"""Auth dependencies — extracted from server.py (Phase 3 refactor).

Centralizes:
- `Permission` constants + `ROLE_PERMISSIONS` mapping
- `has_permission` helper
- `security` HTTPBearer instance
- `get_current_user` FastAPI dependency (decodes JWT, loads user)
- `require_permission` factory

Behavior unchanged from previous inline version in server.py.

DB access note: the test suite swaps `server.db = test_database` (see
backend/tests/conftest.py). So `get_current_user` looks up the user via
`server.db` at call time (lazy import inside the function) instead of
binding a reference at module load. This keeps tests working without
any conftest changes.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.config import settings
from app.models import User

# --- JWT config (aliased from central settings) -----------------------------
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM

# --- HTTP Bearer auth scheme ------------------------------------------------
security = HTTPBearer()


# --- RBAC: permission constants + role mapping ------------------------------

class Permission:
    # Article permissions
    VIEW_ARTICLES = "view_articles"
    CREATE_ARTICLE = "create_article"
    EDIT_ARTICLE = "edit_article"
    DELETE_ARTICLE = "delete_article"

    # Stock permissions
    VIEW_STOCK = "view_stock"
    EDIT_STOCK = "edit_stock"

    # Event permissions
    VIEW_EVENTS = "view_events"
    CREATE_EVENT = "create_event"
    EDIT_EVENT = "edit_event"
    DELETE_EVENT = "delete_event"

    # Customer permissions
    VIEW_CUSTOMERS = "view_customers"
    CREATE_CUSTOMER = "create_customer"
    EDIT_CUSTOMER = "edit_customer"

    # Invoice permissions
    CREATE_INVOICE = "create_invoice"
    VIEW_INVOICES = "view_invoices"

    # Booking permissions
    CREATE_BOOKING = "create_booking"
    EDIT_BOOKING = "edit_booking"
    VIEW_BOOKINGS = "view_bookings"

    # Quote permissions
    CREATE_QUOTE = "create_quote"
    VIEW_QUOTES = "view_quotes"
    EDIT_QUOTE = "edit_quote"

    # Admin permissions
    MANAGE_USERS = "manage_users"
    VIEW_REPORTS = "view_reports"
    ADMIN_ACCESS = "admin_access"
    BACKUP_DATABASE = "backup_database"


ROLE_PERMISSIONS = {
    "admin": [
        Permission.VIEW_ARTICLES, Permission.CREATE_ARTICLE, Permission.EDIT_ARTICLE, Permission.DELETE_ARTICLE,
        Permission.VIEW_STOCK, Permission.EDIT_STOCK,
        Permission.VIEW_EVENTS, Permission.CREATE_EVENT, Permission.EDIT_EVENT, Permission.DELETE_EVENT,
        Permission.VIEW_CUSTOMERS, Permission.CREATE_CUSTOMER, Permission.EDIT_CUSTOMER,
        Permission.MANAGE_USERS, Permission.VIEW_REPORTS, Permission.ADMIN_ACCESS, Permission.BACKUP_DATABASE,
        Permission.CREATE_INVOICE, Permission.VIEW_INVOICES,
        Permission.CREATE_BOOKING, Permission.EDIT_BOOKING, Permission.VIEW_BOOKINGS,
        Permission.CREATE_QUOTE, Permission.VIEW_QUOTES, Permission.EDIT_QUOTE,
    ],
    "lager": [
        Permission.VIEW_ARTICLES, Permission.CREATE_ARTICLE, Permission.EDIT_ARTICLE,
        Permission.VIEW_STOCK, Permission.EDIT_STOCK,
        Permission.VIEW_EVENTS, Permission.CREATE_EVENT, Permission.EDIT_EVENT,
        Permission.VIEW_CUSTOMERS, Permission.CREATE_CUSTOMER,
        Permission.VIEW_REPORTS, Permission.CREATE_INVOICE, Permission.VIEW_INVOICES,
        Permission.CREATE_BOOKING, Permission.EDIT_BOOKING, Permission.VIEW_BOOKINGS,
        Permission.CREATE_QUOTE, Permission.VIEW_QUOTES,
    ],
    "techniker": [
        Permission.VIEW_ARTICLES, Permission.EDIT_ARTICLE,
        Permission.VIEW_STOCK,
        Permission.VIEW_EVENTS,
        Permission.VIEW_CUSTOMERS,
        Permission.VIEW_BOOKINGS,
    ],
    # F12: New fine-grained roles
    "viewer": [
        # Read-only access across all main entities
        Permission.VIEW_ARTICLES,
        Permission.VIEW_STOCK,
        Permission.VIEW_EVENTS,
        Permission.VIEW_CUSTOMERS,
        Permission.VIEW_REPORTS,
    ],
    "fahrer": [
        # Drivers: see events + articles (for loading/unloading), no customer/financial data
        Permission.VIEW_ARTICLES,
        Permission.VIEW_STOCK,
        Permission.VIEW_EVENTS,
    ],
}


def has_permission(user_role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    return permission in ROLE_PERMISSIONS.get(user_role, [])


# --- JWT / current-user dependency ------------------------------------------

def _get_db():
    """Return the active Motor database handle.

    Deferred to call time on purpose: the test suite swaps
    `server.db = test_database` (see backend/tests/conftest.py), so we
    must read the attribute through the `server` module — not bind a
    reference at module import.
    """
    import server  # lazy — server.py imports this file during its own import
    return server.db


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])  # M1: hardcoded, no algorithm confusion
        username: str = payload.get("sub")
        # No default — missing "type" field must also be rejected
        token_type: str = payload.get("type")

        # Only allow access tokens for regular API calls
        if token_type != "access":
            raise credentials_exception

        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = _get_db()
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return User(**user)


def require_permission(permission: str):
    """Dependency factory to enforce a permission on a route."""
    async def permission_checker(current_user: User = Depends(get_current_user)):
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=403,
                detail="Keine Berechtigung für diese Aktion",
            )
        return current_user
    return permission_checker
