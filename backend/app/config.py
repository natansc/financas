from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Conexao Banco de Dados
    DATABASE_URL: str

    # Chaves Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # Credenciais Pluggy
    PLUGGY_CLIENT_ID: str
    PLUGGY_CLIENT_SECRET: str
    PLUGGY_BASE_URL: str = "https://api.pluggy.ai"
    PLUGGY_TOKEN_TTL: int = 3500

    # Configuracao Pydantic v2
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()