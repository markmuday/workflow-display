from contextvars import ContextVar
from functools import wraps
from uuid import uuid4

from google.cloud.sql.connector import Connector
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

from config import settings

transaction_context: ContextVar[str] = ContextVar('transaction_context', default='')


def get_transaction_id():
    return transaction_context.get()


def create_gcp_connector():
    connector = Connector()
    return connector.connect(
        settings.db_connection,
        'pg8000',
        user=settings.db_username,
        password=settings.db_password,
        db=settings.db_name
    )


engine = create_engine('postgresql+pg8000://', creator=create_gcp_connector, pool_pre_ping=True)
factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
ScopedSession = scoped_session(factory, scopefunc=get_transaction_id)


def get_db():
    return ScopedSession()


def transactional(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        transaction_id = uuid4().hex
        context = transaction_context.set(transaction_id)
        session = ScopedSession()

        try:
            result = func(*args, **kwargs)
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            ScopedSession.remove()
            transaction_context.reset(context)

        return result

    return wrapper
