import decimal
from datetime import date, datetime
from typing import Tuple, Callable
from uuid import UUID

from db.database import get_db


def convert_date_to_ymd_string(val):
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, date):
        return val.strftime('%Y-%m-%d')
    return val


def convert_datetime_to_iso_string(val):
    if isinstance(val, datetime):
        date_format = '%Y-%m-%dT%H:%M:%S.%f%z'
        if val.tzinfo is None:
            date_format = '%Y-%m-%dT%H:%M:%S.%f%z+0000'
        return val.strftime(date_format)
    return val


def convert_uuids_and_timestamps_to_iso_string(val):
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, datetime):
        date_format = '%Y-%m-%dT%H:%M:%S.%f%z'
        if val.tzinfo is None:
            date_format = '%Y-%m-%dT%H:%M:%S.%f%z+0000'
        return val.strftime(date_format)
    if isinstance(val, date):
        return val.strftime('%Y-%m-%d')
    return val


def convert_uuids_and_decimals_and_timestamps_to_iso_string(val):
    if isinstance(val, decimal.Decimal):
        return float(val)
    return convert_uuids_and_timestamps_to_iso_string(val)


def query(sql: str,
          params: Tuple = (),
          conversion_fn: Callable = convert_uuids_and_decimals_and_timestamps_to_iso_string):
    results = get_db().connection().exec_driver_sql(sql, params).mappings()
    return [{k: conversion_fn(v) for k, v in result.items()} for result in results]


def execute(sql: str, params: Tuple = ()):
    get_db().connection().exec_driver_sql(sql, params)
