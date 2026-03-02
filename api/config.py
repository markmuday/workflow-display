from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_username: str
    db_password: str
    db_connection: str
    db_name: str

    model_config = SettingsConfigDict(env_file='.env')


settings = Settings()
